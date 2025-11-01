// netlify/functions/business-create.js
const { getDb } = require("./_common/db");
const { requireUser, json } = require("./_common/auth");
const { buildWelcomeEmailHTML, sendMail } = require("./_common/mailer");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "Use POST" }, { Allow: "POST" });
    }

    const user = await requireUser(event); // => { id, email, name }
    const payload = JSON.parse(event.body || "{}");

    // verwacht bv. payload: { name, vat, email } (pas aan aan jouw frontend)
    const name = payload.name || user.name || "";
    const email = payload.email || user.email || "";
    const vat = payload.vat || payload.btw || "";

    const db = await getDb();
    const now = new Date();

    // bewaar business
    const insertRes = await db.collection("businesses").insertOne({
      ownerId: user.id,
      ownerEmail: email || user.email || null,
      name,
      vat,
      createdAt: now,
      updatedAt: now,
    });

    // stuur welkomstmail (niet blokkeren op error: log en ga door)
    try {
      const html = buildWelcomeEmailHTML({ name, email, vat });
      await sendMail({
        to: email || user.email, // stuur naar opgegeven e-mail of user.email
        subject: "Welkom bij Vrijeplek",
        html,
        replyTo: process.env.SMTP_FROM || process.env.EMAIL_FROM,
      });
    } catch (mailErr) {
      // Laat de API-call nog steeds slagen, maar meld dat mailen faalde
      console.error("Mail send failed:", mailErr);
    }

    return json(200, { ok: true, id: insertRes.insertedId });
  } catch (err) {
    const code = err.statusCode || 500;
    return json(code, { ok: false, error: err.message || "Server error" });
  }
};
