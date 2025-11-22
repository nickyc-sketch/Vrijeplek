import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      const date = qs.date || null;
      const email = (qs.email || "").trim().toLowerCase() || null;

      let query = supabase
        .from("slots")
        .select("id,email,date,from,to,desc,booked_at,created_at,active");

      if (date) {
        query = query.eq("date", date);
      }
      if (email) {
        query = query.eq("email", email);
      }

      query = query.order("date", { ascending: true }).order("from", { ascending: true });

      const { data, error } = await query;
      if (error) {
        console.error("slots.GET error:", error);
        return { statusCode: 500, body: "DB error (get)" };
      }

      const mapped = (data || []).map((row) => ({
        ...row,
        start: row.from,
        end: row.to,
        description: row.desc
      }));

      return {
        statusCode: 200,
        body: JSON.stringify(mapped)
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: "Bad JSON" };
    }

    const action = payload.action || "create";

    if (action === "create") {
      const email = (payload.email || "").trim().toLowerCase() || null;
      const date = payload.date;
      const from = payload.from || payload.start || null;
      const to = payload.to || payload.end || null;
      const desc = (payload.desc || payload.description || "").trim();

      if (!date || !from || !to) {
        return { statusCode: 400, body: "Missing fields" };
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
          active: true
        }
      ]);

      if (error) {
        console.error("slots.create error:", error);
        return { statusCode: 500, body: "DB error (create)" };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    if (action === "list") {
      const email = (payload.email || "").trim().toLowerCase();
      if (!email) {
        return { statusCode: 400, body: "Missing email" };
      }

      const { data, error } = await supabase
        .from("slots")
        .select("id,email,date,from,to,desc,booked_at,created_at,active")
        .eq("email", email)
        .order("date", { ascending: true })
        .order("from", { ascending: true });

      if (error) {
        console.error("slots.list error:", error);
        return { statusCode: 500, body: "DB error (list)" };
      }

      const mapped = (data || []).map((row) => ({
        ...row,
        start: row.from,
        end: row.to,
        description: row.desc
      }));

      return {
        statusCode: 200,
        body: JSON.stringify(mapped)
      };
    }

    if (action === "toggle_active") {
      const id = payload.id;
      const active = !!payload.active;

      if (!id) {
        return { statusCode: 400, body: "Missing id" };
      }

      const { error } = await supabase
        .from("slots")
        .update({ active })
        .eq("id", id);

      if (error) {
        console.error("slots.toggle_active error:", error);
        return { statusCode: 500, body: "DB error (toggle)" };
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === "delete") {
      const id = payload.id;
      if (!id) {
        return { statusCode: 400, body: "Missing id" };
      }

      const { error } = await supabase.from("slots").delete().eq("id", id);

      if (error) {
        console.error("slots.delete error:", error);
        return { statusCode: 500, body: "DB error (delete)" };
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (action === "book") {
      const id = payload.id;
      if (!id) {
        return { statusCode: 400, body: "Missing slot id" };
      }

      const { data, error } = await supabase
        .from("slots")
        .update({ booked_at: new Date().toISOString() })
        .eq("id", id)
        .is("booked_at", null)
        .eq("active", true)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("slots.book error:", error);
        return { statusCode: 500, body: "DB error (book)" };
      }

      if (!data) {
        return { statusCode: 409, body: "Slot not available" };
      }

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: "Unknown action" };
  } catch (e) {
    console.error("slots handler crash:", e);
    return { statusCode: 500, body: "Server error" };
  }
}
