// Vul je env via Netlify UI: SUPABASE_URL, SUPABASE_ANON_KEY
// Gebruik op de frontend ALLEEN de ANON key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Wait for config to load
async function getConfig() {
  // Wait for config-loaded event if VRIJEPLEK is not ready
  if (!window.VRIJEPLEK?.SUPABASE_URL || !window.VRIJEPLEK?.SUPABASE_ANON_KEY) {
    await new Promise((resolve) => {
      if (window.VRIJEPLEK?.SUPABASE_URL && window.VRIJEPLEK?.SUPABASE_ANON_KEY) {
        resolve();
        return;
      }
      window.addEventListener('vrijeplek-config-loaded', resolve, { once: true });
      setTimeout(resolve, 3000); // Timeout after 3 seconds
    });
  }

  return {
    SUPABASE_URL: window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || ''
  };
}

// Initialize Supabase client
let supaClient = null;
const initPromise = (async () => {
  const config = await getConfig();
  
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.');
    return null;
  }

  supaClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
  
  return supaClient;
})();

// Export supa - will be initialized asynchronously
export const supa = new Proxy({}, {
  get(target, prop) {
    if (!supaClient) {
      console.warn('Supabase client not initialized yet. Waiting...');
      return initPromise.then(client => client?.[prop]);
    }
    return supaClient[prop];
  }
});

// For methods that need to wait
export async function requireSession(){
  const client = await initPromise;
  if (!client) {
    window.location.href = '/aanmelden.html';
    return null;
  }
  
  const { data } = await client.auth.getSession();
  if(!data.session){
    window.location.href = '/aanmelden.html';
    return null;
  }
  return data.session;
}
