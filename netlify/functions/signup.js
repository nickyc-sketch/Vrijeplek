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
      email, password, plan,
      zaak, telefoon, btw, straat, postcode, cat, website, bio
    } = body;

    if (!email || !password) {
      return { statusCode: 400, body: "Missing credentials: email & password zijn verplicht." };
    }

    const emailRedirectTo = "https://www.vrijeplek.be/geactiveerd.html";

    const { data: sign, error: signErr } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo,
        data: {
          plan: (plan === "yearly" ? "yearly" : "monthly"),
          status: "pending_payment",
          zaak, telefoon, btw, straat, postcode, cat, website, bio
        }
      }
    });

    if (signErr) {
      return { statusCode: 400, body: signErr.message || "Kon geen bevestigingsmail sturen." };
    }

    try {
      await supabase.from("bedrijven").insert([{
        user_id: sign.user?.id || null,
        email, zaak, telefoon, btw, straat, postcode, cat, website, bio,
        plan: (plan === "yearly" ? "yearly" : "monthly"),
        plan_status: "pending_payment"
      }]);
    } catch {}

    return {
      statusCode: 303,
      headers: { Location: "https://www.vrijeplek.be/bedankt.html" }
    };
  } catch {
    return { statusCode: 500, body: "Server error" };
  }
}
