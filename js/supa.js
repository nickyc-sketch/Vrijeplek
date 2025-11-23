// js/supa.js
// Wait for config to load before initializing Supabase
import { waitForConfig } from './config-loader.js';

(async function() {
  try {
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
