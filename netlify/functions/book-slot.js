// netlify/functions/book-slot.js
import { createClient } from "@supabase/supabase-js";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function json(statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function supa() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function looksLikeHtml(s) {
  const t = String(s || "").trim();
  return t.startsWith("<!DOCTYPE") || t.startsWith("<html");
}

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

    const db = supa();

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "bad_json" });
    }

    const slot_id = String(body.slot_id || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const notes = String(body.notes || "").trim();

    if (!slot_id || !name || !email || !phone) {
      return json(400, { error: "missing_fields" });
    }

    // 1) slot ophalen
    const { data: slot, error: slotErr } = await db
      .from("slots")
      .select('id, email, date, "from", "to", "desc", status, booked_at, active')
      .eq("id", slot_id)
      .single();

    if (slotErr) {
      return json(404, { error: "slot_read_failed", details: slotErr.message });
    }
    if (!slot) return json(404, { error: "slot_not_found" });

    if (slot.active === false) return json(409, { error: "slot_inactive" });

    const st = String(slot.status || "").toLowerCase();
    if (st !== "open") {
      return json(409, { error: "slot_unavailable", details: `status=${st}` });
    }

    const providerEmail = String(slot.email || "").toLowerCase();
    if (!providerEmail) return json(500, { error: "slot_missing_provider_email" });

    // 2) provider profile ophalen (deposit settings)
    const { data: prof, error: profErr } = await db
      .from("profiles")
      .select("email, deposit_enabled, deposit_amount, iban, bic, company_name, zaak")
      .eq("email", providerEmail)
      .maybeSingle();

    if (profErr) {
      return json(500, { error: "profile_read_failed", details: profErr.message });
    }

    const deposit_enabled = !!prof?.deposit_enabled;
    const deposit_amount = Number(prof?.deposit_amount || 0) || 0;
    const iban = String(prof?.iban || "").trim();
    const bic = String(prof?.bic || "").trim();

    // Deposit is alleen "actief" als enabled + bedrag >0 + iban aanwezig
    const depositActive = deposit_enabled && deposit_amount > 0 && !!iban;

    const newStatus = depositActive ? "pending_deposit" : "booked";
    const nowIso = new Date().toISOString();

    // 3) slot updaten
    const { error: updErr } = await db
      .from("slots")
      .update({ status: newStatus, booked_at: nowIso })
      .eq("id", slot_id)
      .eq("status", "open"); // simpele race-condition bescherming

    if (updErr) {
      const msg = updErr.message || "";
      return json(500, {
        error: "slot_update_failed",
        details: looksLikeHtml(msg) ? "Unexpected HTML error" : msg,
      });
    }

    // 4) booking bewaren (optioneel maar sterk aangeraden)
    // Als je de bookings-tabel nog niet hebt, maak ze aan met SQL hieronder.
    const bookingRow = {
      slot_id,
      provider_email: providerEmail,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      notes: notes || null,
      status: newStatus,
    };

    // Niet laten crashen als tabel nog niet bestaat:
    const { error: insErr } = await db.from("bookings").insert([bookingRow]);
    // insErr negeren als tabel ontbreekt:
    // (je ziet het wel in Netlify logs)
    if (insErr) {
      console.warn("bookings insert failed:", insErr.message);
    }

    // 5) response voor frontend
    if (depositActive) {
      const message = `VP-${slot_id.slice(0, 8)}-${email.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`.toUpperCase();
      return json(200, {
        ok: true,
        status: newStatus,
        deposit: {
          iban,
          bic: bic || null,
          amount: deposit_amount,
          message,
        },
      });
    }

    return json(200, { ok: true, status: newStatus });
  } catch (e) {
    return json(500, { error: "server_error", message: String(e?.message || e) });
  }
}
