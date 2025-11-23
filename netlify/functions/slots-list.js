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

    // Haal slots op uit Supabase
    const { data, error } = await supabase
      .from('slots')
      .select('id, when, status')
      .order('when', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('Slots list error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: error.message || 'Database error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || [])
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
