// js/supa.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Load from environment or config
const SUPABASE_URL = window.VRIJEPLEK?.SUPABASE_URL || window.ENV?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.VRIJEPLEK?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.');
}

// Maak 1 gedeelde client voor de hele site
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
