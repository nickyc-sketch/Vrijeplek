// netlify/functions/config.js
// Returns public configuration values for client-side use
export async function handler(event) {
  try {
    // Only return public/anon keys, never service role keys
    const config = {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify(config)
    };
  } catch (e) {
    console.error('Config error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Configuration error' })
    };
  }
}

