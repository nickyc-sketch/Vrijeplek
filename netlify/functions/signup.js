
import { getClient, json } from './_lib/db.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const {
    email,
    password,
    full_name = null,
    company = null,
    vat = null,
  } = payload;

  if (!email || !password) {
    return json(400, { error: 'missing_email_or_password' });
    
  }
const redirect = 'https://vrijeplekv2.netlify.app/geactiveerd.html';

  try {
    const supa = getClient();
    const { error } = await supa.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirect,
        data: { full_name, company, vat },
      },
    });

    if (error) return json(400, { error: error.message });
    // Supabase verstuurt nu automatisch de bevestigingsmail
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e.message || 'signup_failed' });
  }
};
