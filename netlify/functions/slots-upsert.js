import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { id, email, date, start, end, description, status, active, places, deposit_required } = body;

    // Support both old format (when) and new format (date, start, end)
    let slotDate, slotStart, slotEnd;
    if (body.when) {
      // Old format: parse "when" field
      const whenStr = String(body.when).trim();
      const parts = whenStr.split(/\s+/);
      slotDate = parts[0] || null;
      slotStart = parts[1] || null;
      slotEnd = parts[2] || null;
    } else {
      slotDate = date;
      slotStart = start;
      slotEnd = end;
    }

    if (!slotDate || !slotStart || !slotEnd) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: date (or when), start, end' })
      };
    }

    const upsertData = {
      email: email ? email.trim().toLowerCase() : null,
      date: slotDate,
      from: slotStart,
      to: slotEnd,
      desc: description || null,
      status: status || 'open',
      active: typeof active === 'boolean' ? active : true,
      places: places || 1,
      deposit_required: typeof deposit_required === 'boolean' ? deposit_required : false
    };

    let query;
    if (id) {
      query = supabase.from('slots').update(upsertData).eq('id', id);
    } else {
      query = supabase.from('slots').insert([upsertData]);
    }

    const { data, error } = await query.select('*');

    if (error) {
      console.error('Slots upsert error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message || 'Database error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || { ok: true })
    };
  } catch (e) {
    console.error('Slots upsert handler error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message || 'Internal server error' })
    };
  }
}
