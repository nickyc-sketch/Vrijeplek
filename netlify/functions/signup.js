// netlify/functions/signup.js
// Simpele, snelle flow: generate signup link -> bij "bestaat al" fallback magic link
// Stuurt mail via jouw SMTP (Combell). Met korte timeouts om "timeout" te vermijden.

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app',
];

function allowOrigin(event){
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  return ALLOWED.includes(origin) ? origin : ALLOWED[0];
}

function json(status, body, event, extraHeaders){
  return {
    statusCode: status,
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowOrigin(event),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    }, extraHeaders || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function parseBody(event){
  const ct = (event.headers && (event.headers['content-type'] || event.headers['Content-Type']) || '').toLowerCase();
  const raw = event.body || '';
  if (ct.includes('application/json')) { try { return JSON.parse(raw || '{}'); } catch { return null; } }
  if (ct.includes('application/x-www-form-urlencoded')) { return Object.fromEntries(new URLSearchParams(raw)); }
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

function withTimeout(promise, ms = 10000){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// Combell: host smtp.mailprotect.be, poort 587, STARTTLS (secure=false)
function makeTransport(){
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true', // true=465, false=587 STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // strakke timeouts zodat het nooit blijft hangen
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000
    // evt: tls: { rejectUnauthorized: false }  // alleen gebruiken als je rare cert issues hebt
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '', event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' }, event, { 'Allow': 'POST, OPTIONS' });

  const body = parseBody(event);
  if (!body) return json(400, { error:'invalid_body' }, event);

  const { email, password, full_name, company, vat } = body;
  if (!email || !password) return json(400, { error:'missing_email_or_password' }, event);

  const site =
    (process.env.SITE_URL?.replace(/\/$/, '')) ||
    ((event.headers && (event.headers.origin || event.headers.Origin)) || 'https://vrijeplek.netlify.app').replace(/\/$/, '');
  const redirectTo = `${site}/bevestigen.html`;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE) return json(500, { error: 'server_misconfigured_supabase' }, event);

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return json(500, { error:'server_misconfigured_smtp' }, event);
  }

  try {
    const supa = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    // 1) Probeer een officiële SIGNUP-bevestigingslink te maken
    let actionLink;
    const signupRes = await withTimeout(supa.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { email_redirect_to: redirectTo, data: { full_name, company, vat } }
    }), 9000);

    if (signupRes && !signupRes.error) {
      actionLink = signupRes.data?.properties?.action_link;
    } else {
      // 2) Als signup faalt (bv. "user already exists"), val terug op MAGICLINK (login-link)
      const magicRes = await withTimeout(supa.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { email_redirect_to: redirectTo }
      }), 9000);
      if (magicRes.error) throw new Error(magicRes.error.message);
      actionLink = magicRes.data?.properties?.action_link;
    }

    if (!actionLink) return json(500, { error:'no_action_link_generated' }, event);

    // 3) Mail versturen via jouw SMTP
    const transporter = makeTransport();
    const from = process.env.SMTP_FROM || `Vrijeplek <${process.env.SMTP_USER}>`;
    const isMagic = actionLink.includes('magic');

    const subject = isMagic ? 'Log in bij Vrijeplek' : 'Bevestig je Vrijeplek-account';
    const plain = [
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

    // eerst (optioneel) checken of SMTP connectie lukt, dan pas versturen
    await withTimeout(transporter.verify(), 7000);
    await withTimeout(transporter.sendMail({ from, to: email, subject, text: plain, html }), 10000);

    return json(200, { ok: true, redirect: redirectTo }, event);

  } catch (e) {
    // We sturen ALTIJD JSON terug, zodat je frontend geen "Network error" krijgt
    return json(500, { error: e?.message || 'signup_failed' }, event);
  }
};
