import { bearer, getAuthUser, getClient, json } from './_lib/db.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'method' });
  const token = bearer(event);
  const { user, error } = await getAuthUser(token);
  if (error || !user) return json(401, { error: 'unauth' });
  const supa = getClient(token);
  const { data: profiel } = await supa.from('profielen').select('*').eq('id', user.id).single();
  return json(200, { user, profiel: profiel || null });
};
