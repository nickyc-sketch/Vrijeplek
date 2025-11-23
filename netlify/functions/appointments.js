// netlify/functions/appointments.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Tabel: appointments(id uuid pk default uuid_generate_v4(), date text, time text, client text, purpose text, note text)

export async function handler(event) {
  try {
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    const action = method === 'GET' ? (queryParams.action || 'list') : (body.action || '');

    if (action === 'list') {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date')
        .order('time');

      if (error) {
        console.error('Appointments list error:', error);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || [])
      };
    }

    if (action === 'publish-slot') {
      const { date, from, to, desc } = body;
      if (!date || !from || !to) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'missing_fields' })
        };
      }

      const { error } = await supabase
        .from('appointments')
        .insert([{ date, time: from, client: '—', purpose: desc || '', note: '' }]);

      if (error) {
        console.error('Publish slot error:', error);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    }

    if (action === 'update') {
      const { id, date, time, client, purpose, note } = body;
      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'missing_id' })
        };
      }

      const { error } = await supabase
        .from('appointments')
        .update({ date, time, client, purpose, note })
        .eq('id', id);

      if (error) {
        console.error('Update appointment error:', error);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'missing_id' })
        };
      }

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete appointment error:', error);
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    }

    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'unknown_action' })
    };
  } catch (err) {
    console.error('Appointments handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
  }
}
