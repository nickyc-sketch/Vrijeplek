// netlify/functions/slots.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed",
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Bad JSON" };
  }

  const action = payload.action || "create";

  try {
    // --------------------------------------------------
    // 1) Dashboard: nieuw tijdslot publiceren
    // --------------------------------------------------
    if (action === "create") {
      const email = (payload.email || "").trim().toLowerCase();
      const date = payload.date;
      const from = payload.from;
      const to = payload.to;
      const desc = (payload.desc || "").trim();

      if (!email || !date || !from || !to) {
        return {
          statusCode: 400,
          body: "Missing fields",
        };
      }

      const { error } = await supabase.from("slots").insert([
        {
          email,
          date,
          from,
          to,
          desc,
          created_at: new Date().toISOString(),
          booked_at: null,
        },
      ]);

      if (error) {
        console.error("slots.create error:", error);
        return {
          statusCode: 500,
          body: "DB error (create)",
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    // --------------------------------------------------
    // 2) Publieke site: tijdslot boeken
    // --------------------------------------------------
    if (action === "book") {
      const id = payload.id;
      if (!id) {
        return { statusCode: 400, body: "Missing slot id" };
      }

      // markeer enkel als nog niet geboekt
      const { data, error } = await supabase
        .from("slots")
        .update({ booked_at: new Date().toISOString() })
        .eq("id", id)
        .is("booked_at", null)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("slots.book error:", error);
        return { statusCode: 500, body: "DB error (book)" };
      }

      if (!data) {
        // ofwel bestaat niet, ofwel al geboekt
        return {
          statusCode: 409,
          body: "Slot not available",
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    // --------------------------------------------------
    // 3) Optioneel: lijst slots per email (voor debug)
    // --------------------------------------------------
    if (action === "list") {
      const email = (payload.email || "").trim().toLowerCase();
      if (!email) {
        return { statusCode: 400, body: "Missing email" };
      }

      const { data, error } = await supabase
        .from("slots")
        .select("id,email,date,from,to,desc,booked_at,created_at")
        .eq("email", email)
        .order("date", { ascending: true })
        .order("from", { ascending: true });

      if (error) {
        console.error("slots.list error:", error);
        return { statusCode: 500, body: "DB error (list)" };
      }

      return {
        statusCode: 200,
        body: JSON.stringify(data || []),
      };
    }

    // onbekende actie
    return {
      statusCode: 400,
      body: "Unknown action",
    };
  } catch (e) {
    console.error("slots handler crash:", e);
    return {
      statusCode: 500,
      body: "Server error",
    };
  }
}
