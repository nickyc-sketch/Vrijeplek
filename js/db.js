// /js/db.js
window.VITE_SUPABASE_URL  = "https://xdmrikvxyeebeusnbzav.supabase.co";
window.VITE_SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbXJpa3Z4eWVlYmV1c25iemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4Mjc5MjgsImV4cCI6MjA3NzQwMzkyOH0.WmOMDZoFSk9RwQE1lT9yUuOCwsMjZbKVQrtNpBflpB0";

if (typeof supabase !== "undefined") {
  window.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
} else {
  console.error('Supabase CDN niet gevonden. Plaats <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> vóór /js/db.js');
}
