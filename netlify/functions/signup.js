// netlify/functions/signup.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reusable headers (CORS + no-cache)
const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: baseHeaders, body: "OK" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: baseHeaders, body: "Method Not Allowed" };
  }

  try {
    // ------ Body parsing (JSON + x-www-form-urlencoded fallback) ------
    const ct = (event.headers["content-type"] || event.headers["Content-Type"] || "").toLowerCase();
    let body = {};
    if (ct.includes("application/json")) {
      body = JSON.parse(event.body || "{}");
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(event.body || ""));
    } else {
      // Probeer JSON als default
      try { body = JSON.parse(event.body || "{}"); } catch {}
    }

    // Haal velden
    let { email, password, zaak, telefoon, btw, straat, postcode, cat, website, bio } = body;

    // Basic checks
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: baseHeaders,
        body: "Missing credentials: email & password zijn verplicht."
      };
    }

    // Website normaliseren (optioneel)
    if (website && typeof website === "string" && website.trim() !== "") {
      website = website.trim();
      if (!/^https?:\/\//i.test(website)) website = "https://" + website;
      try { new URL(website); } catch {
        return {
          statusCode: 400,
          headers: baseHeaders,
          body: "Ongeldige website-URL. Gebruik bv. https://voorbeeld.be of laat leeg."
        };
      }
    } else {
      website = null;
    }

    // ------ Supabase v2 signUp (enkel 1 object met options) ------
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://www.vrijeplek.be/bedankt.html"
      }
    });

    if (error) {
      console.error("Supabase signUp error:", error);
      // Toon heldere foutboodschap voor UI
      let msg = error.message || "Kon geen bevestigingsmail sturen.";
      // Extra hint als het de typische mailer-error is
      if (/Error sending confirmation email/i.test(msg)) {
        msg = "Error sending confirmation email — controleer in Supabase Auth → Email je SMTP/afzender (poort 587 + STARTTLS) en probeer opnieuw.";
      }
      return { statusCode: 400, headers: baseHeaders, body: msg };
    }

    // ------ Optioneel: bedrijf wegschrijven (best-effort) ------
    try {
      await supabase.from("bedrijven").insert([{
        email, zaak, telefoon, btw, straat, postcode, cat, website, bio
      }]);
    } catch (e) {
      console.warn("Insert bedrijven warning:", e?.message || e);
      // Niet falen op soft data error
    }

    // ------ Redirect naar bedankt.html (303 = POST → GET) ------
    return {
      statusCode: 303,
      headers: {
        ...baseHeaders,
        Location: "https://www.vrijeplek.be/bedankt.html"
      },
      body: ""
    };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, headers: baseHeaders, body: "Server error" };
  }
}
