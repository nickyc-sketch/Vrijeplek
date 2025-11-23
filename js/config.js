// Configuration loaded from Netlify function or fallback
// Initialize with empty values first
window.VRIJEPLEK = {
  SUPABASE_URL: window.ENV?.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || ''
};

// Load config from Netlify function
fetch('/.netlify/functions/config')
  .then(res => res.ok ? res.json() : null)
  .then(config => {
    if (config && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
      window.VRIJEPLEK = {
        SUPABASE_URL: config.SUPABASE_URL,
        SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY
      };
      // Dispatch event to notify that config is loaded
      window.dispatchEvent(new CustomEvent('vrijeplek-config-loaded'));
    } else {
      console.warn('Config function returned invalid data, using fallback');
      window.dispatchEvent(new CustomEvent('vrijeplek-config-loaded'));
    }
  })
  .catch(err => {
    console.error('Failed to load config from function:', err);
    // Still dispatch event so pages can proceed with fallback
    window.dispatchEvent(new CustomEvent('vrijeplek-config-loaded'));
  });

