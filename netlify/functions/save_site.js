// netlify/functions/save_site.js
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      slug, title, tagline, about, services,
      phone, website, theme, show_google_reviews,
      google_place, is_public
    } = body;

    if (!slug) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Slug is verplicht." })
      };
    }

    // (Auth) Stuur in je frontend het Supabase access token mee als Bearer
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Niet ingelogd." })
      };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supa = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    let userId = null;
    try {
      const { data: userData, error: userError } = await supa.auth.getUser(token);
      if (userError || !userData?.user) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Ongeldig token." })
        };
      }
      userId = userData.user.id;
    } catch (authErr) {
      console.error('Auth error:', authErr);
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Authenticatie mislukt." })
      };
    }

    const payload = {
      user_id: userId,
      slug: String(slug).trim(),
      title: title ? String(title).trim() : null,
      tagline: tagline ? String(tagline).trim() : null,
      about: about ? String(about).trim() : null,
      services: Array.isArray(services) ? services : null,
      phone: phone ? String(phone).trim() : null,
      website: website ? String(website).trim() : null,
      theme: theme ? String(theme).trim() : null,
      show_google_reviews: !!show_google_reviews,
      google_place: google_place ? String(google_place).trim() : null,
      is_public: !!is_public,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supa
      .from("sites")
      .upsert(payload, { onConflict: "user_id,slug" })
      .select()
      .single();

    if (error) {
      console.error('Save site error:', error);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message || 'Database error' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, site: data })
    };
  } catch (e) {
    console.error('Save site handler error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message || "Server error" })
    };
  }
}
