<script>
window.SUPABASE_URL  = "https://xdmrikvxyeebeusnbzav.supabase.co";
window.SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbXJpa3Z4eWVlYmV1c25iemF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4Mjc5MjgsImV4cCI6MjA3NzQwMzkyOH0.WmOMDZoFSk9RwQE1lT9yUuOCwsMjZbKVQrtNpBflpB0";

if (window.supabase) {
  window.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
} else {
  console.error("Supabase CDN niet gevonden. Zorg dat je deze script-tag na de CDN laadt.");
}
</script>
