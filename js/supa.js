// js/supa.js
// <<< VUL DIT IN MET JOUW ECHTE GEGEVENS >>>
const SUPABASE_URL = "https://xdmrikvxyeebeusnbzav.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbXJpa3Z4eWVlYmV1c25iemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4Mjc5MjgsImV4cCI6MjA3NzQwMzkyOH0.WmOMDZoFSk9RwQE1lT9yUuOCwsMjZbKVQrtNpBflpB0";

// Maak 1 gedeelde client voor de hele site
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
