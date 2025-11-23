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
        plan: 'monthly',
        account_status: 'pending',
        iban: '',
        show_location: false,
        public_calendar: false,
        bank_iban: '',
        deposit_note: '',
        // New dashboard fields
        company_name: '',
        contact_name: '',
        billing_email: '',
        phone: '',
        vat_number: '',
        invoice_note: '',
        deposit_enabled: false,
        deposit_amount: null,
        bic: '',
        extra_footer: ''
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
        // Support both old field names (zaak, telefoon, btw) and new ones (company_name, phone, vat_number)
        zaak: (payload.zaak || payload.company_name || '').trim(),
        telefoon: (payload.telefoon || payload.phone || '').trim(),
        btw: (payload.btw || payload.vat_number || '').trim(),
        cat: (payload.cat || '').trim(),
        straat: (payload.straat || '').trim(),
        postcode: (payload.postcode || '').trim(),
        website: (payload.website || '').trim(),
        bio: (payload.bio || '').trim(),
        iban: (payload.iban || '').trim(),
        show_location: !!payload.show_location,
        public_calendar: !!payload.public_calendar,
        bank_iban: (payload.bank_iban || payload.iban || '').trim(),
        deposit_note: (payload.deposit_note || payload.invoice_note || payload.extra_footer || '').trim(),
        // Store new dashboard fields
        company_name: (payload.company_name || '').trim(),
        contact_name: (payload.contact_name || '').trim(),
        billing_email: (payload.billing_email || '').trim(),
        phone: (payload.phone || '').trim(),
        vat_number: (payload.vat_number || '').trim(),
        invoice_note: (payload.invoice_note || '').trim(),
        deposit_enabled: !!payload.deposit_enabled,
        deposit_amount: payload.deposit_amount != null ? Number(payload.deposit_amount) : null,
        bic: (payload.bic || '').trim(),
        extra_footer: (payload.extra_footer || '').trim()
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
