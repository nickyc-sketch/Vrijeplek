import { bearer, getAuthUser, ensureProfile, json } from './_lib/db.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const token = bearer(event);
  const { user, error } = await getAuthUser(token);
  if (error || !user) return json(401, { error: 'unauth' });

  const extras = JSON.parse(event.body || '{}');
  const { data, error: upErr } = await ensureProfile(user, extras);
  if (upErr) return json(400, { error: upErr.message });
  return json(200, { profiel: data });
};
