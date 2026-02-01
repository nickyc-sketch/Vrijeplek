/*
 * Vrijeplek v2 – aanmelden script
 *
 * Dit script verzamelt de gegevens van het aanmeldformulier en
 * zou normaal gesproken een account aanmaken via Supabase Auth en
 * vervolgens een bedrijfsrecord aanmaken in de database. In deze
 * skeleton wordt enkel een eenvoudige validatie gedaan en een
 * bevestiging getoond. Later voegen we de echte API-calls toe.
 */

(function() {
  const SUPABASE_URL = window?.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window?.SUPABASE_ANON_KEY || '';
  let supabase;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== 'undefined') {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const form = document.getElementById('signup-form');
  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    // Verzamel alle velden
    const data = {
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      business_name: form.business_name.value.trim(),
      address: form.address.value.trim(),
      postal_code: form.postal_code.value.trim(),
      city: form.city.value.trim(),
      category: form.category.value.trim(),
      vat_number: form.vat_number.value.trim(),
      peppol: form.peppol.value.trim(),
      iban: form.iban.value.trim(),
      deposit: form.deposit.value,
      visible_on_location: form.visible_on_location.checked,
      accept_terms: form.accept_terms.checked
    };
    if (!data.accept_terms) {
      alert('Je moet akkoord gaan met de algemene voorwaarden.');
      return;
    }
    // Placeholder: normaal gezien hier Supabase Auth signUp + business insert
    alert('Aanmelding verzonden! We sturen een bevestigingsmail zodra je account is aangemaakt.');
    form.reset();
  });
})();