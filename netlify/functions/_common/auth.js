function json(status, body, headers = {}) {
  return { statusCode: status, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}
function extractUser(event) {
  const idUser = event?.clientContext?.user;
  if (idUser) {
    return {
      id: idUser.sub || idUser.id || idUser.user_id || "unknown",
      email: idUser.email || idUser.user_metadata?.email || null,
      name: idUser.user_metadata?.full_name || idUser.name || idUser.user_metadata?.name || null,
    };
  }
  const h = event?.headers || {};
  const uid = h["x-user-id"] || h["X-User-Id"] || h["x-userid"] || h["X-Userid"];
  const email = h["x-user-email"] || h["X-User-Email"] || h["x-useremail"] || h["X-Useremail"];
  const name = h["x-user-name"] || h["X-User-Name"] || h["x-username"] || h["X-Username"];
  if (uid || email || name) return { id: uid || "header-user", email: email || null, name: name || null };
  return null;
}
async function requireUser(event) {
  const u = extractUser(event);
  if (u) return u;
  if (process.env.NODE_ENV === "development" || process.env.ALLOW_ANON === "true") return { id: "anon", email: null, name: null };
  const err = new Error("Unauthorized"); err.statusCode = 401; throw err;
}
async function currentUser(event){ return extractUser(event); }
module.exports = { requireUser, currentUser, json };
