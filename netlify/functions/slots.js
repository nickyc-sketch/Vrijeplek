import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      const date = qs.date;

      if (!date) {
        return { statusCode: 400, body: "Missing date" };
      }

      const { data, error } = await supabase
        .from("slots")
        .select("id, email, date, from, to, desc, booked_at, active")
        .eq("date", date)
        .order("from", { ascending: true });

      if (error) {
        console.error("slots GET error:", error);
        return { statusCode: 500, body: "DB error (get)" };
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        email: row.email,
        date: row.date,
        start: row.from,
        end: row.to,
        description: row.desc,
        booked_at: row.booked_at,
        active: row.active
      }));

      return {
        statusCode: 200,
        body: JSON.stringify(mapped)
      };
    }

    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, body: "Bad JSON" };
      }

      const date = payload.date;
      const fromTime = payload.start || payload.from || null;
      const toTime = payload.end || payload.to || null;
      const desc = (payload.description || payload.desc || "").trim();
      const email = (payload.email || "").trim().toLowerCase() || null;

      if (!date || !fromTime || !toTime) {
        return { statusCode: 400, body: "Missing fields" };
      }

      const insertData = {
        date,
        from: fromTime,
        to: toTime,
        desc,
        email
      };

      const { error } = await supabase
        .from("slots")
        .insert([insertData]);

      if (error) {
        console.error("slots POST error:", error);
        return {
          statusCode: 500,
          body: "DB error (create): " + error.message
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    return { statusCode: 405, body: "Method not allowed" };
  } catch (e) {
    console.error("slots handler crash:", e);
    return { statusCode: 500, body: "Server error" };
  }
}
