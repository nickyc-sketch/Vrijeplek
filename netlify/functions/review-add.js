const { getDb } = require("./_common/db");
const { json } = require("./_common/auth");
const { ObjectId } = require("mongodb");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "method" });
    }

    const body = JSON.parse(event.body || "{}");
    const { businessId, rating, comment } = body;

    if (!businessId) {
      return json(400, { error: "missing businessId" });
    }

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return json(400, { error: "rating must be between 1 and 5" });
    }

    // Sanitize comment
    const sanitizedComment = comment ? String(comment).trim().substring(0, 1000) : null;

    const db = await getDb();
    await db.collection("businesses").updateOne(
      { _id: new ObjectId(businessId) },
      { $inc: { reviews_count: 1, rating_sum: ratingNum } }
    );

    if (sanitizedComment) {
      await db.collection("reviews").insertOne({
        businessId,
        rating: ratingNum,
        comment: sanitizedComment,
        at: new Date()
      });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('Review add error:', err);
    const code = err.statusCode || 500;
    return json(code, { error: err.message || "Server error" });
  }
};
