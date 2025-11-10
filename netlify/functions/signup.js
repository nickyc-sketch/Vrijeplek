// netlify/functions/signup.js
// Signup/magiclink via Supabase + eigen SMTP (Combell).
// SMTP: probeer 587 (STARTTLS) → fallback 465 (SSL). Duidelijke foutcodes in JSON.

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app',
];

function allowOrigin(event){
  const o = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  return ALLOWED.includes(o) ? o : ALLOWED[0];
}
function json(status, body, event, extra){
  return {
    statusCode: status,
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowOrigin(event),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    }, extra || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
function parseBody(event){
  const ct = (event.headers && (event.headers['content-type'] || event.headers['Content-Type']) || '').toLowerCase();
  const raw = event.body || '';
  if (ct.includes('application/json')) { try { return JSON.parse(raw || '{}'); } catch { return null; } }
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}
function withTimeout(promise, ms = 10000){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { code:'ETIMEOUT' })), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// --- SMTP helpers ---
function makeTransport587(){
  return nodemailer.createTransport({
    name: 'vrijeplek.be',                 // EHLO/HELO hostname
    host: process.env.SMTP_HOST || 'smtp.mailprotect.be',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,                        // STARTTLS
    requireTLS: true,
    family: 4,                            // force IPv4 (soms helpt dit tegen AAAA-timeouts)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: {
      minVersion: 'TLSv1.2',
      servername: process.env.SMTP_HOST || 'smtp.mailprotect.be'
      // desnoods: rejectUnauthorized:false (NIET aanraden tenzij cert-issues)
    },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000
  });
}
function makeTransport465(){
  return nodemailer.createTransport({
    name: 'vrijeplek.be',
    host: process.env.SMTP_HOST || 'smtp.mailprotect.be',
    port: 465,
    secure: true,                         // Implicit TLS
    family: 4,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: {
      minVersion: 'TLSv1.2',
      servername: process.env.SMTP_HOST || 'smtp.mailprotect.be'
    },
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000
  });
}

async function sendMailWithFallback({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || `Vrijeplek <${process.env.SMTP_USER}>`;
  // 1) 587 STARTTLS
  try {
    const t587 = makeTransport587();
    await withTimeout(t587.verify(), 8000);
    const info = await withTimeout(t587.sendMail({ from, to, subject, text, html }), 10000);
    return { ok:true, via:'587', messageId: info && info.messageId };
  } catch (e587) {
    // 2) fallback 465 SSL
    try {
      const t465 = makeTransport465();
      await withTimeout(t465.verify(), 8000);
      const info = await withTimeout(t465.sendMail({ from, to, subject, text, html }), 10000);
      return { ok:true, via:'465', messageId: info && info.messageId, fallback:true, warn: stringifyErr(e587) };
    } catch (e465) {
      return { ok:false, error: 'smtp_failed', first: stringifyErr(e587), second: stringifyErr(e465) };
    }
  }
}

function stringifyErr(e){
  return {
    name: e?.name,
    message: e?.message,
    code: e?.code,
    errno: e?.errno,
    syscall: e?.syscall,
    address: e?.address,
    port: e?.port,
    response: e?.response
  };
}

// ---- handler ----
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '', event);
  if (event.httpMethod !== 'POST') return json(405, { error:'method' }, event, { 'Allow': 'POST, OPTIONS' });

  const body = parseBody(event);
  if (!body) return json(400, { error:'invalid_body' }, event);

  const { email, password, full_name, company, vat } = body;
  if (!email || !password) return json(400, { error:'missing_email_or_password' }, event);

  const site =
    (process.env.SITE_URL?.replace(/\/$/, '')) ||
    ((event.headers && (event.headers.origin || event.headers.Origin)) || 'https://vrijeplek.netlify.app').replace(/\/$/, '');
  const redirectTo = `${site}/bedankt.html`;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE) return json(500, { error:'server_misconfigured_supabase' }, event);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return json(500, { error:'server_misconfigured_smtp', detail:'missing SMTP_USER/SMTP_PASS' }, event);
  }
  // Host: laat default op smtp.mailprotect.be als je het niet hebt gezet
  if (!process.env.SMTP_HOST) {
    // niets doen: makeTransport* gebruiken default host
  }

  try {
    const supa = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    // 1) signup-link proberen
    let actionLink, isMagic = false;
    const s = await withTimeout(supa.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { email_redirect_to: redirectTo, data: { full_name, company, vat } }
    }), 9000);

    if (s && !s.error) {
      actionLink = s.data?.properties?.action_link;
    } else {
      // 2) fallback: magic link (bestaat al / andere reden)
      const m = await withTimeout(supa.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { email_redirect_to: redirectTo }
      }), 9000);
      if (m.error) {
        return json(500, { error:'link_generation_failed', signup_error: s?.error?.message, magic_error: m.error.message }, event);
      }
      isMagic = true;
      actionLink = m.data?.properties?.action_link;
    }

    if (!actionLink) return json(500, { error:'no_action_link_generated' }, event);

    // 3) SMTP verzenden met fallback 587→465
    const subject = isMagic ? 'Log in bij Vrijeplek' : 'Bevestig je Vrijeplek-account';
    const text = [
      `Hallo${full_name ? ' ' + full_name : ''},`,
      '',
      isMagic ? 'Klik op onderstaande link om in te loggen:' : 'Klik op onderstaande link om je account te activeren:',
      actionLink,
      '',
      'Werkt de knop niet? Kopieer de link en plak hem in je browser.',
      '',
      'Groeten,',
      'Team Vrijeplek'
    ].join('\n');

    const html = `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:22px;font-weight:700;color:#0c4a6e;">Vrijeplek</div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${isMagic ? 'Inloggen' : 'Bevestig je account'}</h1>
      <p style="margin:0 0 16px;color:#334155;">Hallo${full_name ? ' ' + full_name : ''}, klik op de knop hieronder om ${isMagic ? 'in te loggen' : 'je account te activeren'}.</p>
      <p style="margin:0 0 20px;">
        <a href="${actionLink}" style="display:inline-block;padding:12px 18px;border-radius:10px;text-decoration:none;background:#0e7490;color:#fff;font-weight:600;">
          ${isMagic ? 'Log in' : 'Account bevestigen'}
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;">Werkt de knop niet? Kopieer deze link in je browser:<br>
        <span style="word-break:break-all;color:#0ea5e9;">${actionLink}</span>
      </p>
    </div>
    <p style="margin-top:16px;font-size:12px;color:#94a3b8;">Na ${isMagic ? 'inloggen' : 'bevestiging'} kom je terug op <strong>${redirectTo}</strong>.</p>
  </div>`.trim();

    const mailResult = await sendMailWithFallback({ to: email, subject, text, html });
    if (!mailResult.ok) {
      return json(502, { error: 'smtp_failed', details: mailResult }, event);
    }

    return json(200, { ok: true, via: mailResult.via, redirect: redirectTo, fallback: !!mailResult.fallback, warn: mailResult.warn }, event);

  } catch (e) {
    return json(500, { error: e?.message || 'signup_failed', code: e?.code }, event);
  }
};
