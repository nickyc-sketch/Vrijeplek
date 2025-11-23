import { createClient } from "@supabase/supabase-js";

/*
 * Supabase client initialization
 *
 * The handler below exposes two endpoints via a Netlify Function:
 *  1. GET /.netlify/functions/slots?date=YYYY-MM-DD
 *     Returns an array of slot objects for the specified date.  We do not
 *     specify any additional filter arguments here: the only mandatory
 *     parameter is `date`.  The query quotes the reserved column names
 *     ("from", "to", "desc") and sorts the results in JavaScript to
 *     avoid issues with SQL keywords.  The response payload includes
 *     normalised field names (start, end, description) that match the
 *     expectations of the front‑end dashboard.
 *
 *  2. POST /.netlify/functions/slots
 *     Creates a new slot.  The POST body should contain `date`, `start` and
 *     `end`, with optional `description` and `email`.  Fields such as
 *     `places` and `visible` from the dashboard are ignored by this function;
 *     only valid column names are inserted.  The slot is created with
 *     status "open" and active = true by default.
 */

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

export async function handler(event) {
  try {
    // Ensure that the environment variables are present
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: "Supabase env not configured" };
    }

    // Handle GET requests: return slots for a given date
    if (event.httpMethod === "GET") {
      const qs   = event.queryStringParameters || {};
      const date = qs.date;

      // Validate date parameter
      if (!date) {
        return { statusCode: 400, body: "Missing date" };
      }

      // Query the slots table for the specified date.  Reserved words (from, to, desc)
      // are quoted so PostgreSQL/Supabase treats them as column names.
      const { data, error } = await supabase
        .from("slots")
        .select('id, email, date, "from", "to", "desc", booked_at, status, active, duration_min')
        .eq("date", date);

      if (error) {
        console.error("slots GET error:", error);
        return { statusCode: 500, body: "DB error (get): " + error.message };
      }

      // Sort the results by start time (the "from" column) in JavaScript rather than SQL.
      const sortedData = (data || []).sort((a, b) => {
        const aStart = a.from || '';
        const bStart = b.from || '';
        return aStart.localeCompare(bStart);
      });

      // Map the column names to the keys expected by the frontend.
      const mapped = sortedData.map(row => ({
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

    // Handle POST requests: create a new slot
    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, body: "Bad JSON" };
      }

      // Extract and normalise fields from the POST payload.  The dashboard
      // sometimes sends `start`, `end`, `description` keys, but also accepts
      // `from`, `to`, `desc`.  We handle both forms gracefully.
      const email       = (payload.email || "").trim().toLowerCase() || null;
      const date        = payload.date;
      const start       = payload.start || payload.from || null;
      const end         = payload.end   || payload.to   || null;
      const description = (payload.description || payload.desc || "").trim();

      // Ensure mandatory fields are present
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

    // All other methods are not allowed
    return { statusCode: 405, body: "Method not allowed" };
  } catch (err) {
    console.error("slots handler crash:", err);
    return { statusCode: 500, body: "Server error" };
  }
}
