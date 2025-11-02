// js/login.js
(function () {
  const form = document.getElementById('login-form');
  const emailEl = document.getElementById('email');
  const pwdEl = document.getElementById('password');
  const errorEl = document.getElementById('error');
  const btn = document.getElementById('login-btn');

  const showError = (msg) => {
    errorEl.textContent = msg;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    btn.disabled = true;

    const email = emailEl.value.trim();
    const password = pwdEl.value;

    try {
      const { data, error } = await window.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Typische fouten netjes mappen
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          showError("Oeps! We vonden jouw account niet terug. Meld je hier aan.");
        } else if (msg.includes("email not confirmed") || msg.includes("email not confirmed")) {
          showError("Je e-mail is nog niet bevestigd. Check je inbox (of spam) en bevestig je e-mail.");
        } else {
          showError("Inloggen mislukt. Probeer opnieuw of reset je wachtwoord.");
        }

        btn.disabled = false;
        return;
      }

      // success → naar dashboard
      window.location.href = "/dashboard.html";
    } catch (err) {
      showError("Netwerkfout bij inloggen. Herlaad de pagina en probeer opnieuw.");
      btn.disabled = false;
    }
  });
})();
