// netlify/functions/search.js
import { createClient } from '@supabase/supabase-js';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export async function handler(event) {
  try{
    if(event.httpMethod === 'OPTIONS'){
      return { statusCode:204, headers, body:'' };
    }

    if(event.httpMethod !== 'POST'){
      return { statusCode:405, headers, body:JSON.stringify({ error:'Method Not Allowed' }) };
    }

    const supa = client();
    const body = JSON.parse(event.body || '{}');

    const q   = (body.q   || '').trim();
    const loc = (body.loc || '').trim();
    const cat = (body.cat || '').trim();
    const from = (body.from || '').trim();
    const to   = (body.to   || '').trim();

    const dateFrom = from || todayISO();
    const dateTo   = to   || null;

    // 1) Profielen ophalen (active OF leeg)
    let profQuery = supa
      .from('profiles')
      .select([
        'email',
        'company_name',
        'zaak',
        'cat',
        'business_city',
        'gemeente',
        'plaats',
        'business_street',
        'straat',
        'business_postcode',
        'postcode',
        'website',
        'bio',
        'account_status',
        'deposit_enabled',
        'deposit_amount',
        'iban',
        'bic'
      ].join(','))
      .or('account_status.eq.active,account_status.is.null');

    const sanitizedQ = q ? String(q).trim().substring(0, 100) : '';
    const sanitizedLoc = loc ? String(loc).trim().substring(0, 100) : '';

    if(sanitizedQ){
      // ✅ zoek ook op company_name
      profQuery = profQuery.or(
        `company_name.ilike.%${sanitizedQ}%,zaak.ilike.%${sanitizedQ}%,email.ilike.%${sanitizedQ}%`
      );
    }

    if(sanitizedLoc){
      profQuery = profQuery.or(
        `business_city.ilike.%${sanitizedLoc}%,gemeente.ilike.%${sanitizedLoc}%,plaats.ilike.%${sanitizedLoc}%,business_postcode.ilike.%${sanitizedLoc}%,postcode.ilike.%${sanitizedLoc}%,business_street.ilike.%${sanitizedLoc}%,straat.ilike.%${sanitizedLoc}%`
      );
    }

    if(cat){
      profQuery = profQuery.eq('cat', cat);
    }

    const { data: profiles, error: profErr } = await profQuery.limit(80);

    if(profErr){
      return { statusCode:500, headers, body:JSON.stringify({ error:'profiles_failed', details:profErr.message }) };
    }

    if(!profiles || !profiles.length){
      return { statusCode:200, headers, body:JSON.stringify({ profiles: [], slots: [] }) };
    }

    const emails = profiles
      .map(p => (p.email || '').toLowerCase())
      .filter(Boolean);

    // 2) Slots ophalen (open)
    let slotQuery = supa
      .from('slots')
      .select('id, email, date, "from", "to", "desc", status, booked_at, active')
      .in('email', emails)
      .eq('active', true)
      .eq('status', 'open');

    if(dateFrom) slotQuery = slotQuery.gte('date', dateFrom);
    if(dateTo)   slotQuery = slotQuery.lte('date', dateTo);

    const { data: slots, error: slotErr } = await slotQuery;

    if(slotErr){
      return { statusCode:500, headers, body:JSON.stringify({ error:'slots_failed', details:slotErr.message }) };
    }

    return { statusCode:200, headers, body:JSON.stringify({ profiles, slots: (slots || []) }) };

  }catch(e){
    return { statusCode:500, headers, body:JSON.stringify({ error:'server_error', message:String(e?.message || e) }) };
  }
}
