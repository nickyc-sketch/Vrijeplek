import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE } = process.env;

export function getClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
}

export function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

export function bearer(event) {
  const h = event.headers || {};
  const v = h.authorization || h.Authorization || '';
  const [s, t] = v.split(' ');
  return s?.toLowerCase() === 'bearer' ? t : null;
}

export async function getAuthUser(accessToken) {
  if (!accessToken) return { user: null, error: new Error('no token') };
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  return { user: data?.user ?? null, error };
}

export async function ensureProfile(user, extra = {}) {
  const admin = getAdminClient();
  const payload = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? null,
    ...extra,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from('profielen').upsert(payload, { onConflict: 'id' }).select().single();
  return { data, error };
}

export function json(status, body, headers = {}) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) };
}
