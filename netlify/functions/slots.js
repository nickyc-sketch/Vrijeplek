import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

function json(statusCode, payload){
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function mapRow(row){
  return {
    id: row.id,
    email: row.email,
    date: row.date,
    start: row.from,
    end: row.to,
    description: row.desc,
    booked_at: row.booked_at,
    active: row.active,
    status: row.status,
  };
}

function normalizeStatus(status){
  const s = (status || "").toLowerCase();
  if (s === "booked" || s === "geboekt" || s === "bezet") return "booked";
  if (s === "pending_deposit") return "pending_deposit";
  return "open";
}

export async function handler(event) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Supabase env not configured" });
    }

    const method = event.httpMethod;
    const qs     = event.queryStringParameters || {};

    // --------------------------------
    // GET
    // 1) Oud: /slots?date=YYYY-MM-DD (& optioneel email)
    // 2) Nieuw: /slots?email=...&from=YYYY-MM-DD&to=YYYY-MM-DD&status=open,booked&split=1
    // --------------------------------
    if (method === "GET") {
      const date = (qs.date || "").trim(); // YYYY-MM-DD
      const email = (qs.email || "").trim().toLowerCase();
      const statusRaw = (qs.status || "").trim(); // "open,booked"
      const dateFrom = (qs.from || "").trim();
      const dateTo = (qs.to || "").trim();
      const split = (qs.split || "").trim() === "1";

      // 1) Per datum (backward compatible)
      if (date) {
        let q = supabase
          .from("slots")
          .select('id, email, date, "from", "to", "desc", booked_at, status, active')
          .eq("date", date)
          .eq("active", true)
          .order("from", { ascending: true });

        if (email) {
          q = q.eq("email", email);
        }

        const { data, error } = await q;

        if (error) {
          console.error("slots GET error:", error);
          return json(500, { error: "DB error (get): " + error.message });
        }

        const mapped = (data || []).map(mapRow);
        return json(200, mapped);
      }

      // 2) Lijst voor provider (dashboard)
      if (!email) {
        return json(400, { error: "Missing date parameter OR email parameter" });
      }

      let q = supabase
        .from("slots")
        .select('id, email, date, "from", "to", "desc", booked_at, status, active')
        .eq("email", email)
        .eq("active", true)
        .order("date", { ascending: true })
        .order("from", { ascending: true });

      if (statusRaw) {
        const statuses = statusRaw.split(",").map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) q = q.eq("status", statuses[0]);
        else q = q.in("status", statuses);
      }

      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo)   q = q.lte("date", dateTo);

      const { data, error } = await q;

      if (error) {
        console.error("slots GET list error:", error);
        return json(500, { error: "DB error (list): " + error.message });
      }

      const mapped = (data || []).map(mapRow);

      // ✅ split=1 -> { booked:[], open:[] }
      if (split) {
        const booked = [];
        const open = [];

        for (const item of mapped) {
          const st = normalizeStatus(item.status);
          if (st === "booked" || st === "pending_deposit") booked.push(item);
          else open.push(item);
        }

        return json(200, { booked, open });
      }

      return json(200, mapped);
    }

    // --------------------------------
    // POST /slots
    // body: { email, date, start, end, description }
    // --------------------------------
    if (method === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Bad JSON" });
      }

      const email       = (payload.email || "").trim().toLowerCase() || null;
      const date        = payload.date;
      const start       = payload.start || null;
      const end         = payload.end || null;
      const description = (payload.description || "").trim();

      if (!date || !start || !end) {
        return json(400, { error: "Missing fields" });
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
        return json(500, { error: "DB error (create): " + error.message });
      }

      return json(200, { ok: true });
    }

    // --------------------------------
    // PUT /slots
    // body: { id, start?, end?, description? }
    // --------------------------------
    if (method === "PUT") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(400, { error: "Bad JSON" });
      }

      const id          = payload.id;
      const start       = payload.start;
      const end         = payload.end;
      const description = payload.description;

      if (!id) {
        return json(400, { error: "Missing id parameter" });
      }

      const updateData = {};
      if (start !== undefined)       updateData.from  = start;
      if (end !== undefined)         updateData.to    = end;
      if (description !== undefined) updateData.desc  = description;

      if (Object.keys(updateData).length === 0) {
        return json(400, { error: "Nothing to update" });
      }

      const { error } = await supabase
        .from("slots")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error("slots PUT error:", error);
        return json(500, { error: "DB error (update): " + error.message });
      }

      return json(200, { ok: true });
    }

    // --------------------------------
    // DELETE /slots?id=...
    // --------------------------------
    if (method === "DELETE") {
      const id = (qs.id || "").trim();

      if (!id) {
        return json(400, { error: "Missing id" });
      }

      const { error } = await supabase
        .from("slots")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("slots DELETE error:", error);
        return json(500, { error: "DB error (delete): " + error.message });
      }

      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed" });

  } catch (err) {
    console.error("slots handler crash:", err);
    return json(500, { error: "Server error", message: err.message });
  }
}
