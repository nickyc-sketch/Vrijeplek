// login.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supa = createClient(window.env.SUPABASE_URL, window.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const form   = document.getElementById('login-form');
const emailI = document.getElementById('login-email');
const passI  = document.getElementById('login-password');
const msg    = document.getElementById('login-msg');

function setMsg(t) { if (msg) msg.textContent = t || ''; }

form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  setMsg('Aan het aanmelden…');

  const email = (emailI.value || '').trim().toLowerCase();
  const pwd   = passI.value || '';

  if (!email || !pwd) {
    setMsg('Vul je e-mail en wachtwoord in.');
    return;
  }

  const { data, error } = await supa.auth.signInWithPassword({ email, password: pwd });

  if (error) {
    setMsg('Aanmelden mislukt: ' + (error.message || 'controleer je gegevens.'));
    return;
  }

  // succes → meteen naar dashboard MET e-mail in de URL
  setMsg('');
  window.location.href = 'dashboard.html?email=' + encodeURIComponent(email);
});
