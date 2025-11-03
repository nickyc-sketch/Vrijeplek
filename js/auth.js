<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = 'https://xdmrikvxyeebeusnbzav.supabase.co';
  const SUPABASE_ANON_KEY = '<eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbXJpa3Z4eWVlYmV1c25iemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4Mjc5MjgsImV4cCI6MjA3NzQwMzkyOH0.WmOMDZoFSk9RwQE1lT9yUuOCwsMjZbKVQrtNpBflpB0>';

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
