/*
 * Vrijeplek v2 – dashboard script
 *
 * Dit script voorziet placeholders voor het laden en opslaan van
 * bedrijfsgegevens, het aanmaken van tijdslots en het tonen van
 * boekingsaanvragen. De daadwerkelijke implementatie met Supabase
 * volgt later.
 */

(function() {
  const SUPABASE_URL = window?.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window?.SUPABASE_ANON_KEY || '';
  let supabase;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== 'undefined') {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Placeholder voor het laden van bedrijfsgegevens
  const businessForm = document.getElementById('business-form');
  businessForm.addEventListener('submit', function(e) {
    e.preventDefault();
    // Verzamel data en stuur naar Supabase
    alert('Opslaan van bedrijfsgegevens is nog niet geïmplementeerd.');
  });

  // Knop voor tijdslot toevoegen
  const addSlotBtn = document.getElementById('add-slot');
  addSlotBtn.addEventListener('click', function() {
    // Open een formulier of modal voor het toevoegen van een nieuw tijdslot
    alert('Tijdslot toevoegen is nog niet geïmplementeerd.');
  });

  // Placeholder voor het laden van boekingsaanvragen
  function loadBookings() {
    const bookingsList = document.getElementById('bookings-list');
    bookingsList.innerHTML = '<p>Het laden van boekingsaanvragen is nog niet geïmplementeerd.</p>';
  }

  // Initialiseren van dashboard
  function init() {
    loadBookings();
  }
  init();
})();