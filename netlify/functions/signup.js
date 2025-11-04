// CommonJS-style Netlify Function to play nice with mixed CJS in repo
const { createClient } = require('@supabase/supabase-js');

const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app'
];

function allowOrigin(event){
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  return ALLOWED.includes(origin) ? origin : ALLOWED[0];
}

function json(status, body, headers){
  return {
    statusCode: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
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
    return json(405, { error: 'method' }, { 'Access-Control-Allow-Origin': allowOrigin(event), 'Allow': 'POST, OPTIONS' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error:'invalid_json' }, { 'Access-Control-Allow-Origin': allowOrigin(event) }); }

  const { email, password, full_name, company, vat } = payload || {};
  if (!email || !password) {
    return json(400, { error:'missing_email_or_password' }, { 'Access-Control-Allow-Origin': allowOrigin(event) });
  }

  const site = ((process.env.SITE_URL) || (event.headers && (event.headers.origin || event.headers.Origin)) || 'https://vrijeplek.netlify.app').replace(/\/$/, '');
  const redirect = `${site}/geactiveerd.html`;

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');

    const supa = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supa.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirect, data: { full_name, company, vat } }
    });

    if (error) {
      return json(400, { error: error.message }, { 'Access-Control-Allow-Origin': allowOrigin(event) });
    }
    return json(200, { ok:true, redirect }, { 'Access-Control-Allow-Origin': allowOrigin(event) });
  } catch (e) {
    return json(500, { error: e.message || 'signup_failed' }, { 'Access-Control-Allow-Origin': allowOrigin(event) });
  }
};
