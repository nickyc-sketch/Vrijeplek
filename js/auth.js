<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = 'https://<JOUW-PROJECT>.supabase.co';
  const SUPABASE_ANON_KEY = '<JE-ANON-KEY>';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Form: <form id="signupForm"> met <input id="email"> en <input id="password">
  const form = document.getElementById('signupForm');
  const msg  = document.getElementById('signupMsg'); // <div id="signupMsg"></div>

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
</script>
