const { getDb } = require("./_common/db");
const { requireUser, json } = require("./_common/auth");

exports.handler = async (event, context) => {
  try {
    // Alleen GET toestaan
    if (event.httpMethod !== "GET") {
      return json(405, { ok: false, error: "Method Not Allowed" }, { Allow: "GET" });
    }

    // user (email/id) ophalen — laat anon toe in dev of met ALLOW_ANON=true
    const user = await requireUser(event);

    // query params
    const params = new URLSearchParams(event.queryStringParameters || {});
    const businessId = params.get("businessId");
    if (!businessId) return json(400, { ok: false, error: "Missing businessId" });

    const db = await getDb();
    const slots = await db
      .collection("slots")
      .find({ businessId })
      .sort({ start: 1 })
      .limit(1000)
      .toArray();

    return json(200, { ok: true, user: { id: user.id, email: user.email || null }, businessId, count: slots.length, slots });
  } catch (err) {
    const code = err.statusCode || 500;
    return json(code, { ok: false, error: err.message || "Server error" });
  }
};
