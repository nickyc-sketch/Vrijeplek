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
    const {
      email, password,
      zaak, telefoon, btw, straat, postcode, cat, website, bio
    } = body;

    if (!email || !password) {
      return { statusCode: 400, body: "Missing credentials: email & password zijn verplicht." };
    }

    // 1) User aanmaken + bevestigingsmail laten sturen
    const { data, error } = await supabase.auth.signUp(
      { email, password },
      { emailRedirectTo: "https://www.vrijeplek.be/bedankt.html" }
    );

    if (error) {
      // Belangrijk: dit is o.a. waar “Error sending confirmation email” binnenkomt
      console.error("Supabase signUp error:", error);
      // Geef duidelijke tekst terug voor de UI:
      return { statusCode: 400, body: error.message || "Kon geen bevestigingsmail sturen." };
    }

    // 2) Optioneel: bedrijfsgegevens bewaren (best effort, maar faal niet hard)
    try {
      await supabase.from("bedrijven").insert([{
        email, zaak, telefoon, btw, straat, postcode, cat, website, bio
      }]);
    } catch (e) {
      console.warn("Insert bedrijven warning:", e?.message || e);
    }

    // 3) Netjes redirecten naar bedankt-pagina (GET nav, geen re-POST)
    return {
      statusCode: 303,
      headers: { Location: "https://www.vrijeplek.be/bedankt.html" }
    };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}
