const { getDb } = require("./_common/db");
const { requireUser, json } = require("./_common/auth");

exports.handler = async (event, context) => {
  try {
    const user = await requireUser(event);
    if (!user) return json(401, { error: "auth" });
  const db = await getDb();
  const list = await db.collection("businesses")
    .find({ owner_sub: user.sub })
    .sort({ created_at: -1 })
    .toArray();
    const clean = list.map(x => ({
      id: x._id, name: x.name, category: x.category, address: x.address,
      logo_url: x.logo_url, views_total: x.views_total,
      rating_avg: x.reviews_count ? (x.rating_sum / x.reviews_count) : 0,
      reviews_count: x.reviews_count
    }));
    return json(200, { items: clean });
  } catch (err) {
    console.error('Business mine error:', err);
    const code = err.statusCode || 500;
    return json(code, { error: err.message || "Server error" });
  }
};
