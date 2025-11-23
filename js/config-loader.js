// js/config-loader.js
// Helper function to wait for config to load and initialize Supabase
// Usage: await initSupabaseClient().then(supabase => { ... })

export async function waitForConfig(timeout = 5000) {
  // If config is already loaded, return immediately
  if (window.VRIJEPLEK?.SUPABASE_URL && window.VRIJEPLEK?.SUPABASE_ANON_KEY) {
    return {
      SUPABASE_URL: window.VRIJEPLEK.SUPABASE_URL,
      SUPABASE_ANON_KEY: window.VRIJEPLEK.SUPABASE_ANON_KEY
    };
  }

  // Wait for config-loaded event
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Timeout - try with whatever we have
      resolve({
        SUPABASE_URL: window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || ''
      });
    }, timeout);

    window.addEventListener('vrijeplek-config-loaded', () => {
      clearTimeout(timeoutId);
      resolve({
        SUPABASE_URL: window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || ''
      });
    }, { once: true });
  });
}

export async function initSupabaseClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const config = await waitForConfig();
  
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured. Check Netlify environment variables.');
  }

  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: localStorage
    }
  });
}

