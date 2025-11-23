const { getDb } = require("./_common/db");
const { json } = require("./_common/auth");

const { ObjectId } = require("mongodb");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "method" });
    }

    const body = JSON.parse(event.body || "{}");
    const { businessId } = body;

    if (!businessId) {
      return json(400, { error: "missing businessId" });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(businessId)) {
      return json(400, { error: "invalid businessId format" });
    }

    const db = await getDb();
    const result = await db.collection("businesses").updateOne(
      { _id: new ObjectId(businessId) },
      { $inc: { views_total: 1 } }
    );

    if (result.matchedCount === 0) {
      return json(404, { error: "business not found" });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('Track view error:', err);
    const code = err.statusCode || 500;
    return json(code, { error: err.message || "Server error" });
  }
};
