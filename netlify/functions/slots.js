import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

const json = (statusCode, payload) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const normalizeStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "booked" || v === "geboekt" || v === "bezet") return "booked";
  if (v === "pending_deposit") return "pending_deposit";
  return "open";
};

const mapRow = (row) => ({
  id: row.id,
  email: row.email,
  date: row.date,
  start: row.from,
  end: row.to,
  description: row.desc,
  booked_at: row.booked_at,
  active: row.active,
  status: normalizeStatus(row.status),
});

export async function handler(event) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Supabase not configured" });
    }

    const method = event.httpMethod;
    const qs = event.queryStringParameters || {};

    // ======================
    // GET
    // ======================
    if (method === "GET") {
      const date = (qs.date || "").trim();
      const email = (qs.email || "").trim().toLowerCase();
      const from = (qs.from || "").trim();
      const to = (qs.to || "").trim();
      const split = qs.split === "1";

      // ---- per dag (kalender)
      if (date) {
        let q = supabase
          .from("slots")
          .select('id,email,date,"from","to","desc",booked_at,status,active')
          .eq("date", date)
          .eq("active", true)
          .order("from", { ascending: true });

        if (email) q = q.eq("email", email);

        const { data, error } = await q;
        if (error) return json(500, { error: error.message });

        return json(200, (data || []).map(mapRow));
      }

      // ---- dashboard lijst
      if (!email) return json(400, { error: "email required" });

      let q = supabase
        .from("slots")
        .select('id,email,date,"from","to","desc",booked_at,status,active')
        .eq("email", email)
        .eq("active", true)
        .order("date", { ascending: true })
        .order("from", { ascending: true });

      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);

      const { data, error } = await q;
      if (error) return json(500, { error: error.message });

      const mapped = (data || []).map(mapRow);

      if (!split) return json(200, mapped);

      const booked = [];
      const open = [];

      for (const s of mapped) {
        if (s.status === "booked" || s.status === "pending_deposit") booked.push(s);
        else open.push(s);
      }

      return json(200, { booked, open });
    }

    // ======================
    // POST → nieuw slot
    // ======================
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");

      if (!body.date || !body.start || !body.end) {
        return json(400, { error: "missing fields" });
      }
      if (body.start >= body.end) {
        return json(400, { error: "start must be before end" });
      }

      const insert = {
        email: (body.email || "").trim().toLowerCase(),
        date: body.date,
        from: body.start,
        to: body.end,
        desc: (body.description || "").trim(),
        status: "open",
        active: true,
      };

      const { error } = await supabase.from("slots").insert([insert]);
      if (error) return json(500, { error: error.message });

      return json(200, { ok: true });
    }

    // ======================
    // PUT → update slot
    // ======================
    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      if (!body.id) return json(400, { error: "id required" });

      const { data: existing } = await supabase
        .from("slots")
        .select("status,booked_at")
        .eq("id", body.id)
        .single();

      if (!existing) return json(404, { error: "slot not found" });

      const st = normalizeStatus(existing.status);
      if (st !== "open") {
        return json(403, { error: "slot is booked" });
      }

      const update = {};
      if (body.start) update.from = body.start;
      if (body.end) update.to = body.end;
      if (body.description !== undefined) update.desc = body.description;

      if (!Object.keys(update).length) {
        return json(400, { error: "nothing to update" });
      }

      const { error } = await supabase.from("slots").update(update).eq("id", body.id);
      if (error) return json(500, { error: error.message });

      return json(200, { ok: true });
    }

    // ======================
    // DELETE → soft delete
    // ======================
    if (method === "DELETE") {
      const id = (qs.id || "").trim();
      if (!id) return json(400, { error: "id required" });

      const { data: existing } = await supabase
        .from("slots")
        .select("status")
        .eq("id", id)
        .single();

      if (!existing) return json(404, { error: "slot not found" });

      const st = normalizeStatus(existing.status);
      if (st !== "open") {
        return json(403, { error: "slot is booked" });
      }

      const { error } = await supabase
        .from("slots")
        .update({ active: false })
        .eq("id", id);

      if (error) return json(500, { error: error.message });

      return json(200, { ok: true });
    }

    return json(405, { error: "method not allowed" });

  } catch (err) {
    console.error(err);
    return json(500, { error: "server error", message: err.message });
  }
}
