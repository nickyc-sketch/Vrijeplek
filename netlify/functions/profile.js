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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeStatus(raw) {
  const s = (raw ?? '').toString().trim().toLowerCase();
  if (!s) return 'pending';
  if (s === 'actief') return 'active';
  return s;
}

function cleanIban(raw) {
  const s = (raw || '').replace(/\s+/g, '').toUpperCase();
  if (!s) return '';
  if (!/^BE\d{2}\d{4}\d{4}\d{4}$/.test(s)) return null;
  return s;
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    const supa = client();

    if (event.httpMethod === 'GET') {
      const qs = new URLSearchParams(event.rawQuery || '');
      const email = (qs.get('email') || '').trim().toLowerCase();

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
        show_location: false,
        public_calendar: true,
        notify_mail: true,
        daily_mail: false,
        deposit_enabled: false,
        deposit_amount: 0,
        deposit_note: '',
        bank_iban: '',
        plan: 'monthly',
        account_status: 'pending'
      };

      row.account_status = normalizeStatus(row.account_status || row.status || 'pending');

      return { statusCode: 200, headers, body: JSON.stringify(row) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');

      const email = (payload.email || '').trim().toLowerCase();
      if (!email) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'email_required' }) };
      }

      const ibanClean = cleanIban(payload.bank_iban);
      if (ibanClean === null) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'invalid_iban' })
        };
      }

      const depositAmount =
        payload.deposit_amount === undefined || payload.deposit_amount === null
          ? 0
          : Number(payload.deposit_amount) || 0;

      const up = {
        email,
        zaak: (payload.zaak || '').trim(),
        telefoon: (payload.telefoon || '').trim(),
        btw: (payload.btw || '').trim(),
        cat: (payload.cat || '').trim(),
        straat: (payload.straat || '').trim(),
        postcode: (payload.postcode || '').trim(),
        website: (payload.website || '').trim(),
        bio: (payload.bio || '').trim(),
        show_location: !!payload.show_location,
        public_calendar: !!payload.public_calendar,
        notify_mail: !!payload.notify_mail,
        daily_mail: !!payload.daily_mail,
        deposit_enabled: !!payload.deposit_enabled,
        deposit_amount: depositAmount,
        deposit_note: (payload.deposit_note || '').trim(),
        bank_iban: ibanClean || ''
      };

      if (payload.plan) up.plan = String(payload.plan);
      if (payload.account_status) up.account_status = normalizeStatus(payload.account_status);

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
