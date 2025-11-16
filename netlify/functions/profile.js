// netlify/functions/profile.js
import { createClient } from '@supabase/supabase-js';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side only
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    const supa = client();

    if (event.httpMethod === 'GET') {
      // BELANGRIJK: email uit query halen via queryStringParameters
      const email = (event.queryStringParameters?.email || '').trim().toLowerCase();

      if (!email) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'email_required' }) };
      }

      const { data, error } = await supa
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'db_select_failed', details: error.message })
        };
      }

      const row = data || {
        email,
        zaak: '',
        telefoon: '',
        btw: '',
        cat: '',
        straat: '',
        postcode: '',
        website: '',
        bio: '',
        plan: 'monthly',
        account_status: 'pending'
      };

      return { statusCode: 200, headers, body: JSON.stringify(row) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');

      const email = (payload.email || '').trim().toLowerCase();
      if (!email) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'email_required' }) };
      }

      const up = {
        email,
        zaak: (payload.zaak || '').trim(),
        telefoon: (payload.telefoon || '').trim(),
        btw: (payload.btw || '').trim(),
        cat: (payload.cat || '').trim(),
        straat: (payload.straat || '').trim(),
        postcode: (payload.postcode || '').trim(),
        website: (payload.website || '').trim(),
        bio: (payload.bio || '').trim()
      };

      if (payload.plan) up.plan = String(payload.plan);
      if (payload.account_status) up.account_status = String(payload.account_status);

      const { data, error } = await supa
        .from('profiles')
        .upsert(up, { onConflict: 'email' })
        .select()
        .single();

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'db_upsert_failed', details: error.message })
        };
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, profile: data }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'server_error', message: String(e?.message || e) })
    };
  }
}
