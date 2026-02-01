/*
 * Vrijeplek v2 – index page script
 *
 * Deze module initialiseert Supabase en handelt het zoekformulier af. De daadwerkelijke
 * zoekfunctionaliteit zal in een later stadium geïmplementeerd worden. Voor nu
 * tonen we een placeholder wanneer het formulier verzonden wordt.
 */

(function() {
  // Vervang deze waarden met je eigen Supabase projectgegevens. In productie
  // gebruik je env-variabelen via je bundler of injectie tijdens build.
  const SUPABASE_URL = window?.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window?.SUPABASE_ANON_KEY || '';

  // Alleen initialiseren als beide waarden aanwezig zijn
  let supabase;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && typeof window.supabase !== 'undefined') {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const searchForm = document.getElementById('search-form');
  const resultsEl = document.getElementById('results');

  searchForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const category = document.getElementById('category').value.trim();
    const location = document.getElementById('location').value.trim();
    const date = document.getElementById('date').value;

    // Placeholder resultaat – hier komt straks de Supabase query
    resultsEl.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'result-card';
    placeholder.innerHTML = `
      <h3>Zoekfunctie nog niet beschikbaar</h3>
      <p>We werken eraan om je binnenkort realtime resultaten te tonen voor <strong>${category}</strong> in <strong>${location}</strong> op datum <strong>${date || 'any'}</strong>.</p>
    `;
    resultsEl.appendChild(placeholder);

    // Voorbeeld van hoe een query eruit zou kunnen zien:
    // if (supabase) {
    //   const { data, error } = await supabase
    //     .from('public_businesses')
    //     .select('*')
    //     .ilike('category', `%${category}%`)
    //     .ilike('city', `%${location}%`);
    //   // Render data...
    // }
  });
})();