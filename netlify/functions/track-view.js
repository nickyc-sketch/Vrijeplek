const { getDb } = require("./_common/db");
const { json } = require("./_common/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method" });
  const { businessId } = JSON.parse(event.body || "{}");
  if (!businessId) return json(400, { error: "missing" });
  const db = await getDb();
  await db.collection("businesses").updateOne(
    { _id: new (require("mongodb").ObjectId)(businessId) },
    { $inc: { views_total: 1 } }
  );
  return json(200, { ok: true });
};
