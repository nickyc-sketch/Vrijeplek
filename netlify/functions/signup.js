// netlify/functions/signup.js
// CommonJS voor Netlify
const { createClient } = require('@supabase/supabase-js');

const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app',
  // voeg testdomeinen toe indien nodig:
  // 'https://vrijeplekv2.netlify.app'
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
      'Vary': 'Origin'
    }, extraHeaders || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

// parse zowel JSON als x-www-form-urlencoded
function parseBody(event){
  const ctype = (event.headers && (event.headers['content-type'] || event.headers['Content-Type']) || '').toLowerCase();
  const raw = event.body || '';
  if (ctype.includes('application/json')) {
    try { return JSON.parse(raw || '{}'); } catch { return null; }
  }
  // urlencoded (bv. <form method="post">)
  if (ctype.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  // fallback: probeer JSON
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

// simpele timeout wrapper om 504 te vermijden
function withTimeout(promise, ms = 9000){
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin(event),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method' }, event, { 'Allow': 'POST, OPTIONS' });
  }

  const payload = parseBody(event);
  if (!payload) {
    return json(400, { error:'invalid_body' }, event);
  }

  const { email, password, full_name, company, vat } = payload;
  if (!email || !password) {
    return json(400, { error:'missing_email_or_password' }, event);
  }

  const site =
  (process.env.SITE_URL?.replace(/\/$/, '')) ||
  ((event.headers && (event.headers.origin || event.headers.Origin)) || 'https://vrijeplek.netlify.app').replace(/\/$/, '');

const redirect = `${site}/bevestigen.html`;

  try {
    const url = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY; // ← BELANGRIJK
    if (!url || !serviceRole) {
      return json(500, { error: 'Server misconfigured (SUPABASE_URL or SERVICE_ROLE missing)' }, event);
    }

    const supa = createClient(url, serviceRole, { auth: { persistSession: false } });

    // admin route → betrouwbaarder dan anon.signUp in backend
    const task = supa.auth.admin.createUser({
      email,
      password,
      email_confirm: false,                   // forceer bevestigingsmail
      user_metadata: { full_name, company, vat },
      email_redirect_to: redirect            // let op: admin API gebruikt 'email_redirect_to'
    });

    const { data, error } = await withTimeout(task, 9000);

    if (error) {
      return json(400, { error: error.message }, event);
    }

    return json(200, { ok: true, redirect, user_id: data.user?.id }, event);

  } catch (e) {
    // als het echt een timeout was, maak 'm duidelijk
    const msg = e && e.message ? e.message : 'signup_failed';
    return json(500, { error: msg }, event);
  }
};
