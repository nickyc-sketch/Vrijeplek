// Vul je env via Netlify UI: SUPABASE_URL, SUPABASE_ANON_KEY
// Gebruik op de frontend ALLEEN de ANON key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'


export const supa = createClient(
window.ENV?.SUPABASE_URL || (https://xdmrikvxyeebeusnbzav.supabase.co== 'undefined' ? SUPABASE_URL : ''),
window.ENV?.SUPABASE_ANON_KEY || (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbXJpa3Z4eWVlYmV1c25iemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4Mjc5MjgsImV4cCI6MjA3NzQwMzkyOH0.WmOMDZoFSk9RwQE1lT9yUuOCwsMjZbKVQrtNpBflpB0== 'undefined' ? SUPABASE_ANON_KEY : '')
)


export async function requireSession(){
const { data } = await supa.auth.getSession();
if(!data.session){
window.location.href = '/aanmelden.html';
return null;
}
return data.session;
}
