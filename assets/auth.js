// Vul je env via Netlify UI: SUPABASE_URL, SUPABASE_ANON_KEY
// Gebruik op de frontend ALLEEN de ANON key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = window.ENV?.SUPABASE_URL || window.VRIJEPLEK?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || window.VRIJEPLEK?.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.');
}

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});


export async function requireSession(){
const { data } = await supa.auth.getSession();
if(!data.session){
window.location.href = '/aanmelden.html';
return null;
}
return data.session;
}
