// netlify/functions/profile.js
export async function handler(event) {
  try {
    // CORS & headers
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    // In het echt zou je hier in Supabase/DB opslaan.
    // Voor nu: zorg voor geldige JSON, zodat je UI nooit crasht.

    if (event.httpMethod === 'GET') {
      const email = new URLSearchParams(event.rawQuery || '').get('email') || '';
      // Dummy profiel teruggeven zodat de UI iets heeft
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
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
          account_status: 'pending'
        })
      };
    }

    if (event.httpMethod === 'POST') {
      // Gewoon alles terug-echoën, plus ok:true
      const payload = JSON.parse(event.body || '{}');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, saved: payload })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'server_error', message: String(e?.message || e) })
    };
  }
}
