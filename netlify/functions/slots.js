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
        .select('id, email, date, "from", "to", desc, booked_at, status, active, duration_min')
        .eq("date", date)
        .order("from", { ascending: true });

      if (error) {
        return { statusCode: 500, body: "DB error (get): " + error.message };
      }

      const mapped = (data || []).map(row => ({
        id: row.id,
        email: row.email,
        date: row.date,
        start: row.from,
        end: row.to,
        description: row.desc,
        booked_at: row.booked_at,
        active: row.active,
        status: row.status,
        duration_min: row.duration_min
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

      const email = (payload.email || "").trim().toLowerCase() || null;
      const date = payload.date;
      const start = payload.start || null;
      const end = payload.end || null;
      const description = (payload.description || "").trim();

      if (!date || !start || !end) {
        return { statusCode: 400, body: "Missing fields" };
      }

      const insertData = {
        email,
        date,
        from: start,
        to: end,
        desc: description,
        active: true,
        status: "open"
      };

      const { error } = await supabase
        .from("slots")
        .insert([insertData]);

      if (error) {
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

  } catch (err) {
    return { statusCode: 500, body: "Server error" };
  }
}
