// netlify/functions/save_site.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      slug, title, tagline, about, services,
      phone, website, theme, show_google_reviews,
      google_place, is_public
    } = body;

    if (!slug) return { statusCode: 400, body: "Slug is verplicht." };

    // (Auth) Stuur in je frontend het Supabase access token mee als Bearer
    const auth = event.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    const supa = createClient(
      supabaseUrl,
      supabaseServiceKey,
      token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
    );

    let userId = null;
    if (token) {
      const { data: userData } = await supa.auth.getUser(token);
      userId = userData?.user?.id || null;
    }
    if (!userId) return { statusCode: 401, body: "Niet ingelogd." };

    const payload = {
      user_id: userId, slug, title, tagline, about,
      services, phone, website, theme,
      show_google_reviews, google_place, is_public,
      updated_at: new Date().toISOString()
    };

    const { error } = await supa
      .from("sites")
      .upsert(payload, { onConflict: "user_id,slug" });

    if (error) return { statusCode: 400, body: error.message };
    return { statusCode: 200, body: "OK" };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "Server error" };
  }
}
