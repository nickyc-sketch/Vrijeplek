// js/supa.js
// Wait for config to load before initializing Supabase
(async function() {
  try {
    // Wait for config to load
    function waitForConfig() {
      return new Promise((resolve) => {
        if (window.VRIJEPLEK?.SUPABASE_URL && window.VRIJEPLEK?.SUPABASE_ANON_KEY) {
          resolve({
            SUPABASE_URL: window.VRIJEPLEK.SUPABASE_URL,
            SUPABASE_ANON_KEY: window.VRIJEPLEK.SUPABASE_ANON_KEY
          });
          return;
        }

        window.addEventListener('vrijeplek-config-loaded', () => {
          resolve({
            SUPABASE_URL: window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '',
            SUPABASE_ANON_KEY: window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || ''
          });
        }, { once: true });

        setTimeout(() => {
          resolve({
            SUPABASE_URL: window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '',
            SUPABASE_ANON_KEY: window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || ''
          });
        }, 3000);
      });
    }

    const config = await waitForConfig();
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      console.error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.');
      return;
    }

    // Maak 1 gedeelde client voor de hele site
    window.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });

    // Dispatch event when supabase is ready
    window.dispatchEvent(new CustomEvent('supabase-ready'));
  } catch (err) {
    console.error('Failed to initialize Supabase:', err);
  }
})();
