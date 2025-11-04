// ESM helper module used by multiple Functions (works with esbuild bundler)
import { createClient } from '@supabase/supabase-js';

/** Minimal JSON helper */
export function json(status = 200, body = {}, headers = {}) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/** Supabase client (server-side) */
export function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or key');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Extract Bearer token from Authorization header */
export function bearer(event){
  const h = event?.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/** Get current user (if you verify JWT elsewhere) — safe fallback */
export async function getAuthUser(/* token */){
  // Implement your verification if needed; safe fallback:
  return null;
}

/** Ensure profile exists — no-op fallback (won't throw) */
export async function ensureProfile(/* client, user */){
  return true;
}
