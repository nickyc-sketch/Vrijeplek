// netlify/functions/slots.js
import { createClient } from '@supabase/supabase-js';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    const supa = client();

    // LIST
    if (event.httpMethod === 'GET') {
      const qs = new URLSearchParams(event.rawQuery || '');
      const email = (qs.get('email') || '').trim().toLowerCase();
      const date  = (qs.get('date')  || '').trim();

      let q = supa
        .from('slots')
        .select('*')
        .order('date', { ascending: true })
        .order('from', { ascending: true });

      if (email) q = q.eq('email', email);
      if (date)  q = q.eq('date', date);

      const { data, error } = await q;
      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'db_select_failed', details: error.message })
        };
      }

      return { statusCode: 200, headers, body: JSON.stringify(data || []) };
    }

    // CREATE
    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');

      const email = (payload.email || '').trim().toLowerCase();
      const date  = (payload.date  || '').trim();
      const from  = (payload.from  || '').trim();
      const to    = (payload.to    || '').trim();
      const desc  = (payload.desc  || '').trim();

      if (!email || !date || !from || !to) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'missing_fields' })
        };
      }

      const row = {
        email,
        date,    // bv. "2025-11-16"
        from,    // bv. "14:00"
        to,      // bv. "15:00"
        desc,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supa
        .from('slots')
        .insert(row)
        .select()
        .single();

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'db_insert_failed', details: error.message })
        };
      }

      return { statusCode: 200, headers, body: JSON.stringify(data) };
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
