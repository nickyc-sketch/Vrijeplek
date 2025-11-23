import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export async function handler(event) {
  try {
    // Alleen GET toestaan
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Method Not Allowed' })
      };
    }

    // Haal slots op uit Supabase - use new schema
    const qs = event.queryStringParameters || {};
    const email = qs.email ? qs.email.trim().toLowerCase() : null;
    const date = qs.date || null;

    let query = supabase
      .from('slots')
      .select('id, email, date, from, to, desc, status, active, places, deposit_required, with_deposit, is_booked, booked_at')
      .eq('active', true);

    if (email) query = query.eq('email', email);
    if (date) query = query.eq('date', date);

    query = query.order('date', { ascending: true }).order('from', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Slots list error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: error.message || 'Database error' })
      };
    }

    // Map to consistent format
    const mapped = (data || []).map(row => ({
      id: row.id,
      email: row.email,
      date: row.date,
      start: row.from,
      end: row.to,
      description: row.desc,
      status: row.status || 'open',
      active: row.active,
      places: row.places || 1,
      deposit_required: row.deposit_required || false,
      with_deposit: row.with_deposit || false,
      is_booked: row.is_booked || false,
      booked_at: row.booked_at
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped)
    };
  } catch (err) {
    console.error('Slots list handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message || 'Server error' })
    };
  }
}
