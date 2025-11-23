import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

export async function handler(event) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Supabase env not configured" })
      };
    }

    const method = event.httpMethod;
    const qs     = event.queryStringParameters || {};

    // --------------------------------
    // GET /slots?date=YYYY-MM-DD
    // --------------------------------
    if (method === "GET") {
      const date = qs.date;

      if (!date) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Missing date parameter" })
        };
      }

      const { data, error } = await supabase
        .from("slots")
        .select('id, email, date, "from", "to", "desc", booked_at, status, active')
        .eq("date", date);

      if (error) {
        console.error("slots GET error:", error);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "DB error (get): " + error.message })
        };
      }

      const mapped = (data || [])
        .map((row) => ({
          id: row.id,
          email: row.email,
          date: row.date,
          start: row.from,
          end: row.to,
          description: row.desc,
          booked_at: row.booked_at,
          active: row.active,
          status: row.status,
        }))
        .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapped),
      };
    }

    // --------------------------------
    // POST /slots   (tijdslot aanmaken)
    // body: { date, start, end, description, email? }
    // --------------------------------
    if (method === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, body: "Bad JSON" };
      }

      const email       = (payload.email || "").trim().toLowerCase() || null;
      const date        = payload.date;
      const start       = payload.start || null;
      const end         = payload.end || null;
      const description = (payload.description || "").trim();

      if (!date || !start || !end) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Missing fields" })
        };
      }

      const insertData = {
        email,
        date,
        from: start,
        to: end,
        desc: description,
        active: true,
        status: "open",
      };

      const { error } = await supabase.from("slots").insert([insertData]);

      if (error) {
        console.error("slots POST error:", error);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "DB error (create): " + error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      };
    }

    // --------------------------------
    // PUT /slots   (tijdslot bijwerken)
    // body: { id, start?, end?, description? }
    // --------------------------------
    if (method === "PUT") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Bad JSON" })
        };
      }

      const id          = payload.id;
      const start       = payload.start;
      const end         = payload.end;
      const description = payload.description;

      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Missing id parameter" })
        };
      }

      const updateData = {};
      if (start !== undefined)       updateData.from  = start;
      if (end !== undefined)         updateData.to    = end;
      if (description !== undefined) updateData.desc  = description;

      if (Object.keys(updateData).length === 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Nothing to update" })
        };
      }

      const { error } = await supabase
        .from("slots")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error("slots PUT error:", error);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "DB error (update): " + error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      };
    }

    // --------------------------------
    // DELETE /slots?id=...
    // --------------------------------
    if (method === "DELETE") {
      const id = qs.id;

      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "Missing id" })
        };
      }

      const { error } = await supabase
        .from("slots")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("slots DELETE error:", error);
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: "DB error (delete): " + error.message })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      };
    }

    // --------------------------------
    // ALLES ANDERS → 405
    // --------------------------------
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Method not allowed" })
    };

  } catch (err) {
    console.error("slots handler crash:", err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Server error", message: err.message })
    };
  }
}
