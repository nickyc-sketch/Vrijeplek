// netlify/functions/book-slot.js
import { createClient } from '@supabase/supabase-js';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function supa() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

const json = (statusCode, payload) => ({
  statusCode,
  headers,
  body: JSON.stringify(payload),
});

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    const body = JSON.parse(event.body || '{}');

    const slot_id = String(body.slot_id || '').trim();
    const name = String(body.name || '').trim();
    const customer_email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const notes = String(body.notes || '').trim();

    if (!slot_id || !name || !customer_email || !phone) {
      return json(400, { error: 'missing_fields', message: 'Vul naam, e-mail en telefoon in.' });
    }

    const client = supa();

    // 1) Slot ophalen
    const { data: slot, error: slotErr } = await client
      .from('slots')
      .select('id,email,status,booked_at,active,deposit_required,with_deposit,deposit_amount')
      .eq('id', slot_id)
      .maybeSingle();

    if (slotErr) return json(500, { error: 'slot_read_failed', details: slotErr.message });
    if (!slot || slot.active === false) return json(404, { error: 'slot_not_found' });

    const status = String(slot.status || 'open').toLowerCase();
    if (status !== 'open') {
      return json(409, { error: 'slot_not_available', message: 'Dit tijdslot is niet meer beschikbaar.' });
    }

    const providerEmail = String(slot.email || '').toLowerCase();
    if (!providerEmail) return json(500, { error: 'slot_missing_provider_email' });

    // 2) Profiel van aanbieder ophalen (voor voorschot/IBAN)
    const { data: prof, error: profErr } = await client
      .from('profiles')
      .select('email,company_name,zaak,deposit_enabled,deposit_amount,iban,bic')
      .eq('email', providerEmail)
      .maybeSingle();

    if (profErr) return json(500, { error: 'profile_read_failed', details: profErr.message });
    if (!prof) return json(500, { error: 'provider_profile_not_found' });

    // 3) Bepalen voorschot (slot of profiel)
    const slotDepositOn = !!(slot.deposit_required || slot.with_deposit);
    const profDepositOn = !!prof.deposit_enabled;

    const depositActive = slotDepositOn || profDepositOn;

    const amount =
      Number(slot.deposit_amount ?? 0) > 0 ? Number(slot.deposit_amount)
      : Number(prof.deposit_amount ?? 0) > 0 ? Number(prof.deposit_amount)
      : 0;

    const iban = String(prof.iban || '').trim();
    const bic = String(prof.bic || '').trim();

    // Als voorschot “aan” staat maar geen bedrag/IBAN → behandel alsof geen voorschot
    const useDeposit = depositActive && amount > 0 && !!iban;

    // 4) Slot markeren
    const nextStatus = useDeposit ? 'pending_deposit' : 'booked';

    const { error: updErr } = await client
      .from('slots')
      .update({
        status: nextStatus,
        booked_at: new Date().toISOString(),
        // We slaan klantgegevens niet op in slots (veiligste zonder schema-kennis).
        // Als je later een bookings-tabel wil: zeg het en ik maak die netjes.
      })
      .eq('id', slot.id)
      .eq('status', 'open'); // extra race-condition guard

    if (updErr) return json(500, { error: 'slot_update_failed', details: updErr.message });

    // 5) Response naar frontend (modal)
    if (useDeposit) {
      const merchantName = prof.company_name || prof.zaak || providerEmail;
      return json(200, {
        ok: true,
        mode: 'deposit_bank',
        message: 'Boeking ontvangen. Voorschotinfo volgt.',
        deposit: {
          iban,
          bic: bic || '—',
          amount: amount,
          message: `Voorschot Vrijeplek — ${merchantName} — slot ${slot.id} — ${customer_email}`,
        },
      });
    }

    return json(200, {
      ok: true,
      mode: 'no_deposit',
      message: 'Boeking ontvangen.',
      notes_received: !!notes,
    });
  } catch (e) {
    return json(500, { error: 'server_error', message: String(e?.message || e) });
  }
}
