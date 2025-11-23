import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export async function handler(event) {
  try {
    // Support both POST (body) and DELETE (query param)
    let id;
    if (event.httpMethod === 'DELETE') {
      const qs = event.queryStringParameters || {};
      id = qs.id;
    } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      id = body.id;
    } else {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    if (!id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required field: id' })
      };
    }

    const { error } = await supabase
      .from('slots')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Slots delete error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message || 'Database error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    console.error('Slots delete handler error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message || 'Internal server error' })
    };
  }
}
