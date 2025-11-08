// netlify/functions/signup.js
// Complete signup + eigen SMTP-mail (Combell) + exists-handling (signup of magic link)
// Werkt met Supabase JS v2.x (zonder getUserByEmail in SDK) via REST-admin endpoint.

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// ---- CORS allowlist ----
const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app',
];

// ---- helpers ----
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    }, extraHeaders || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function parseBody(event){
  const ctype = (event.headers && (event.headers['content-type'] || event.headers['Content-Type']) || '').toLowerCase();
  const raw = event.body || '';
  if (ctype.includes('application/json')) { try { return JSON.parse(raw || '{}'); } catch { return null; } }
  if (ctype.includes('application/x-www-form-urlencoded')) { return Object.fromEntries(new URLSearchParams(raw)); }
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

// simpele timeout wrapper (voorkomt Netlify 504)
function withTimeout(promise, ms = 12000){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// SMTP transport uit env (Combell: smtp.mailprotect.be, 587, STARTTLS)
function makeTransport(){
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,                                 // bv. smtp.mailprotect.be
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',     // true => 465 (implicit TLS), false => 587 (STARTTLS)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// Supabase v2 heeft geen admin.getUserByEmail(); gebruik REST admin endpoint
async function getUserByEmailAdmin(email, supabaseUrl, serviceRole){
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      'apikey': serviceRole,
      'Authorization': `Bearer ${serviceRole}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data && Array.isArray(data.users) && data.users.length > 0) {
    return data.users[0];
  }
  return null;
}

// ---- handler ----
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return json(204, '', event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' }, event, { 'Allow': 'POST, OPTIONS' });

  const payload = parseBody(event);
  if (!payload) return json(400, { error:'invalid_body' }, event);

  const { email, password, full_name, company, vat } = payload;
  if (!email || !password) return json(400, { error:'missing_email_or_password' }, event);

  const site =
    (process.env.SITE_URL?.replace(/\/$/, '')) ||
    ((event.headers && (event.headers.origin || event.headers.Origin)) || 'https://vrijeplek.netlify.app').replace(/\/$/, '');
  const redirectTo = `${site}/bevestigen.html`;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; // service_role verplicht
  if (!SUPABASE_URL || !SERVICE) return json(500, { error: 'server_misconfigured_supabase' }, event);

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return json(500, { error:'server_misconfigured_smtp' }, event);
  }

  try {
    const supa = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

    // --- 1) Bepaal juiste actie-link (signup confirm of magic link) ---
    let actionLink;
    const existing = await withTimeout(getUserByEmailAdmin(email, SUPABASE_URL, SERVICE), 9000).catch(() => null);

    if (existing) {
      if (!existing.email_confirmed_at) {
        // bestaat maar nog niet bevestigd -> nieuwe signup confirm link
        const again = await withTimeout(supa.auth.admin.generateLink({
          type: 'signup',
          email,
          password: password || 'Temp!123456',
          options: { email_redirect_to: redirectTo, data: { full_name, company, vat } }
        }), 9000);
        if (again.error) {
          // fallback: magic link
          const mg = await withTimeout(supa.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { email_redirect_to: redirectTo }
          }), 9000);
          if (mg.error) throw new Error(mg.error.message);
          actionLink = mg.data?.properties?.action_link;
        } else {
          actionLink = again.data?.properties?.action_link;
        }
      } else {
        // al bevestigd -> stuur magic link (frictieloos inloggen)
        const mg = await withTimeout(supa.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { email_redirect_to: redirectTo }
        }), 9000);
        if (mg.error) throw new Error(mg.error.message);
        actionLink = mg.data?.properties?.action_link;
      }
    } else {
      // nieuwe user -> signup confirm link
      const created = await withTimeout(supa.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { email_redirect_to: redirectTo, data: { full_name, company, vat } }
      }), 9000);
      if (created.error) throw new Error(created.error.message);
      actionLink = created.data?.properties?.action_link;
    }

    if (!actionLink) return json(500, { error:'no_action_link_generated' }, event);

    // --- 2) Verstuur eigen e-mail via SMTP (branding Vrijeplek) ---
    const transporter = makeTransport();
    const from = process.env.SMTP_FROM || `Vrijeplek <${process.env.SMTP_USER}>`;

    const isMagic = actionLink.includes('type=magiclink') || actionLink.includes('magiclink');
    const subject = isMagic ? 'Log in bij Vrijeplek' : 'Bevestig je Vrijeplek-account';

    const plain = [
      `Hallo${full_name ? ' ' + full_name : ''},`,
      '',
      isMagic
        ? 'Klik op onderstaande link om in te loggen:'
        : 'Klik op onderstaande link om je account te activeren:',
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

    await withTimeout(transporter.sendMail({ from, to: email, subject, text: plain, html }), 12000);

    return json(200, { ok: true, redirect: redirectTo }, event);

  } catch (e) {
    const msg = e && e.message ? e.message : 'signup_failed';
    return json(500, { error: msg }, event);
  }
};
