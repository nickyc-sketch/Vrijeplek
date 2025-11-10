// netlify/functions/signup.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { email, password, zaak, telefoon, btw, straat, postcode, cat, website, bio } = body;

    if (!email || !password) {
      return { statusCode: 400, body: "Missing credentials" };
    }

    // Maak gebruiker aan in Supabase
    const { data, error } = await supabase.auth.signUp(
      { email, password },
      { emailRedirectTo: "https://www.vrijeplek.be/bedankt.html" }
    );

    if (error) {
      console.error("Supabase error:", error.message);
      return { statusCode: 400, body: error.message };
    }

    // Optioneel: bedrijfsgegevens loggen in een aparte tabel
    await supabase.from("bedrijven").insert([
      { email, zaak, telefoon, btw, straat, postcode, cat, website, bio },
    ]);

    // Redirect naar je lokale bedankt-pagina
    return {
      statusCode: 302,
      headers: {
        Location: "https://www.vrijeplek.be/bedankt.html",
      },
    };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}
