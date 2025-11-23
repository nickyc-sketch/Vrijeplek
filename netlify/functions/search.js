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

    // 1) Profielen (actief) ophalen
    let profQuery = supa
      .from('profiles')
      .select('email, zaak, cat, straat, postcode, website, bio, account_status, deposit_enabled, deposit_amount, iban')
      .eq('account_status', 'active');

    // Sanitize search inputs to prevent injection
    const sanitizedQ = q ? String(q).trim().substring(0, 100) : '';
    const sanitizedLoc = loc ? String(loc).trim().substring(0, 100) : '';

    if(sanitizedQ){
      profQuery = profQuery.or(
        `zaak.ilike.%${sanitizedQ}%,email.ilike.%${sanitizedQ}%`
      );
    }

    if(sanitizedLoc){
      profQuery = profQuery.or(
        `postcode.ilike.%${sanitizedLoc}%,straat.ilike.%${sanitizedLoc}%`
      );
    }

    if(cat){
      profQuery = profQuery.eq('cat', cat);
    }

    const { data: profiles, error: profErr } = await profQuery.limit(50);

    if(profErr){
      return {
        statusCode:500,
        headers,
        body:JSON.stringify({ error:'profiles_failed', details:profErr.message })
      };
    }

    if(!profiles || !profiles.length){
      return { statusCode:200, headers, body:JSON.stringify([]) };
    }

    const emails = profiles
      .map(p => (p.email || '').toLowerCase())
      .filter(Boolean);

    // 2) Slots ophalen / filteren
    let slotQuery = supa
      .from('slots')
      .select('id, email, date, from, to, desc, status')
      .in('email', emails)
      .eq('status', 'open'); // alleen open slots

    if(dateFrom){
      slotQuery = slotQuery.gte('date', dateFrom);
    }
    if(dateTo){
      slotQuery = slotQuery.lte('date', dateTo);
    }

    const { data: slots, error: slotErr } = await slotQuery;

    if(slotErr){
      return {
        statusCode:500,
        headers,
        body:JSON.stringify({ error:'slots_failed', details:slotErr.message })
      };
    }

    const grouped = {};
    (slots || []).forEach(s => {
      const key = (s.email || '').toLowerCase();
      if(!key) return;
      (grouped[key] ||= []).push(s);
    });

    Object.values(grouped).forEach(arr => {
      arr.sort((a,b)=>{
        if(a.date === b.date){
          return (a.from || '').localeCompare(b.from || '');
        }
        return (a.date || '').localeCompare(b.date || '');
      });
    });

    const results = profiles
      .map(p => {
        const key = (p.email || '').toLowerCase();
        const userSlots = grouped[key] || [];
        return {
          email: p.email,
          zaak: p.zaak,
          cat: p.cat,
          straat: p.straat,
          postcode: p.postcode,
          website: p.website,
          bio: p.bio,
          deposit_enabled: p.deposit_enabled,
          deposit_amount: p.deposit_amount,
          iban: p.iban,
          slots: userSlots
        };
      })
      .filter(r => r.slots && r.slots.length);

    return { statusCode:200, headers, body:JSON.stringify(results) };
  }catch(e){
    return {
      statusCode:500,
      headers,
      body:JSON.stringify({ error:'server_error', message:String(e?.message || e) })
    };
  }
}
