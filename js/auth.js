<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  // Wait for config to load
  function initSupabase() {
    return new Promise((resolve) => {
      if (window.VRIJEPLEK?.SUPABASE_URL && window.VRIJEPLEK?.SUPABASE_ANON_KEY) {
        resolve(createSupabaseClient());
        return;
      }

      window.addEventListener('vrijeplek-config-loaded', () => {
        resolve(createSupabaseClient());
      }, { once: true });

      setTimeout(() => resolve(createSupabaseClient()), 3000);
    });
  }

  function createSupabaseClient() {
    const SUPABASE_URL = window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || '';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Supabase credentials not configured.');
      return null;
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }

    initSupabase().then(supabase => {
      if (!supabase) return;

      // Form: <form id="signupForm"> met <input id="email"> en <input id="password">
      const form = document.getElementById('signupForm');
      const msg  = document.getElementById('signupMsg'); // <div id="signupMsg"></div>

      if (!form || !msg) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.textContent = 'Versturen...';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'https://vrijeplek.netlify.app/geactiveerd.html'
          }
        });

        if (error) {
          msg.textContent = `Fout: ${error.message}`;
          return;
        }
        msg.textContent = 'Bevestigingsmail verstuurd. Check je inbox (en spam).';
        form.reset();
      });
    }).catch(err => {
      console.error('Supabase init error:', err);
    });
  </script>
