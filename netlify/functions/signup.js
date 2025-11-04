import { getClient, json } from './_lib/db.js';

const ALLOWED = [
  'https://vrijeplek.be',
  'https://www.vrijeplek.be',
  'https://vrijeplek.netlify.app'
];

function allowOrigin(event){
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  return ALLOWED.includes(origin) ? origin : ALLOWED[0];
}

export const handler = async (event) => {
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
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': allowOrigin(event), 'Allow': 'POST, OPTIONS' },
      body: JSON.stringify({ error: 'method' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': allowOrigin(event) },
      body: JSON.stringify({ error: 'invalid_json' })
    };
  }

  const { email, password, full_name, company, vat } = payload || {};
  if (!email || !password) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': allowOrigin(event) },
      body: JSON.stringify({ error: 'missing_email_or_password' })
    };
  }

  const site = (process.env.SITE_URL || event?.headers?.origin || 'https://vrijeplek.netlify.app').replace(/\/$/, '');
  const redirect = `${site}/geactiveerd.html`;

  try {
    const supa = getClient();
    const { error } = await supa.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirect,
        data: { full_name, company, vat },
      },
    });

    if (error) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': allowOrigin(event) },
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin': allowOrigin(event) },
      body: JSON.stringify({ ok: true, redirect })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': allowOrigin(event) },
      body: JSON.stringify({ error: e.message || 'signup_failed' })
    };
  }
};
