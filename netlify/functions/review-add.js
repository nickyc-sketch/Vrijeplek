const { getDb } = require("./_common/db");
const { json } = require("./_common/auth");
const { ObjectId } = require("mongodb");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method" });
  const { businessId, rating, comment } = JSON.parse(event.body || "{}");
  if (!businessId || !rating) return json(400, { error: "missing" });
  const db = await getDb();
  await db.collection("businesses").updateOne(
    { _id: new ObjectId(businessId) },
    { $inc: { reviews_count: 1, rating_sum: Number(rating) } }
  );
  if (comment) {
    await db.collection("reviews").insertOne({ businessId, rating:Number(rating), comment, at:new Date() });
  }
  return json(200, { ok: true });
};
