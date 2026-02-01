// netlify/functions/profile.js
const { createClient } = require("@supabase/supabase-js");

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const toStr = (v) => (v == null ? '' : String(v)).trim();
const toEmail = (v) => toStr(v).toLowerCase();
const toBool = (v) => !!v;
const toNumOrNull = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    const supa = client();

    if (event.httpMethod === 'GET') {
      const qs = new URLSearchParams(event.rawQuery || '');
      const email = toEmail(qs.get('email'));

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

      // Fallback (als er nog geen record is)
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
        extra_footer: '',

        // ✅ Nieuwe adresvelden voor dashboard
        business_street: '',
        business_postcode: '',
        business_city: '',

        // (optioneel) extra voor consistentie
        google_review_enabled: false,
        google_review_url: '',
        share_location_enabled: false
      };

      // ✅ Extra veiligheid: als DB alleen oude straat/postcode heeft, spiegel naar business_*
      // (zodat je dashboard het altijd ingevuld ziet)
      if (!row.business_street) row.business_street = toStr(row.straat);
      if (!row.business_postcode) row.business_postcode = toStr(row.postcode);
      // business_city kan niet betrouwbaar uit oude velden afgeleid worden, dus laten we die zoals is.

      return { statusCode: 200, headers, body: JSON.stringify(row) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');

      const email = toEmail(payload.email);
      if (!email) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'email_required' }) };
      }

      // ✅ Pak adres uit nieuwe dashboard velden OF uit oude velden
      const business_street = toStr(payload.business_street || payload.straat);
      const business_postcode = toStr(payload.business_postcode || payload.postcode);
      const business_city = toStr(payload.business_city || payload.plaats || payload.gemeente);

      const up = {
        email,

        // Support both old field names (zaak, telefoon, btw) and new ones (company_name, phone, vat_number)
        zaak: toStr(payload.zaak || payload.company_name),
        telefoon: toStr(payload.telefoon || payload.phone),
        btw: toStr(payload.btw || payload.vat_number),
        cat: toStr(payload.cat),

        // ✅ Oud + nieuw adres: we vullen BEIDE zodat alles overal blijft werken
        straat: business_street,
        postcode: business_postcode,

        // ✅ Nieuwe adresvelden voor dashboard
        business_street,
        business_postcode,
        business_city,

        website: toStr(payload.website),
        bio: toStr(payload.bio),

        iban: toStr(payload.iban),
        show_location: toBool(payload.show_location),
        public_calendar: toBool(payload.public_calendar),

        bank_iban: toStr(payload.bank_iban || payload.iban),

        // deposit_note (oude) blijft bestaan, maar we nemen ook invoice_note/extra_footer mee
        deposit_note: toStr(payload.deposit_note || payload.invoice_note || payload.extra_footer),

        // Store new dashboard fields
        company_name: toStr(payload.company_name),
        contact_name: toStr(payload.contact_name),
        billing_email: toStr(payload.billing_email),
        phone: toStr(payload.phone),
        vat_number: toStr(payload.vat_number),
        invoice_note: toStr(payload.invoice_note),
        deposit_enabled: toBool(payload.deposit_enabled),
        deposit_amount: toNumOrNull(payload.deposit_amount),
        bic: toStr(payload.bic),
        extra_footer: toStr(payload.extra_footer),

        // (optioneel) extra toggles die je dashboard al kent
        google_review_enabled: toBool(payload.google_review_enabled),
        google_review_url: toStr(payload.google_review_url),
        share_location_enabled: toBool(payload.share_location_enabled)
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
