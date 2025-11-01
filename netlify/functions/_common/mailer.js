// netlify/functions/_common/mailer.js
const { Resend } = require("resend");
const nodemailer = require("nodemailer");

function buildWelcomeEmailHTML({ name, email, vat }) {
  const safe = (v) => (v == null ? "" : String(v));
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Welkom bij Vrijeplek</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; color:#0a0a0a; }
        .card { max-width: 560px; margin: 24px auto; padding: 24px; border:1px solid #e5e7eb; border-radius: 12px; }
        .btn { display:inline-block; padding:12px 18px; text-decoration:none; border-radius:8px; background:#2563eb; color:white; }
        .muted { color:#6b7280; font-size:12px; }
        h1 { font-size:22px; margin:0 0 8px 0; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Welkom, ${safe(name) || "ondernemer"} 👋</h1>
        <p>Je account werd succesvol aangemaakt in <strong>Vrijeplek</strong>.</p>
        <p><strong>Details</strong></p>
        <ul>
          <li>Naam: ${safe(name) || "—"}</li>
          <li>E-mail: ${safe(email) || "—"}</li>
          <li>BTW-nummer: ${safe(vat) || "—"}</li>
        </ul>
        <p style="margin:20px 0">
          <a class="btn" href="${process.env.PUBLIC_BASE_URL || "/"}" target="_blank" rel="noreferrer">Ga naar je dashboard</a>
        </p>
        <p class="muted">Vragen? Antwoord op deze e-mail of contacteer ons via de site.</p>
      </div>
    </body>
  </html>`;
}

async function sendMail({ to, subject, html, replyTo }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || "no-reply@vrijeplek.be";

  // 1) Probeer Resend
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      reply_to: replyTo,
    });
    if (error) throw new Error(`Resend error: ${error.message || error.toString()}`);
    return { provider: "resend", id: data?.id || null };
  }

  // 2) Vallen terug op SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true", // 465->true, 587->false
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const info = await transporter.sendMail({ from, to, subject, html, replyTo });
    return { provider: "smtp", id: info.messageId || null };
  }

  // 3) Niets geconfigureerd
  throw new Error("Geen mailprovider geconfigureerd. Zet RESEND_API_KEY of SMTP_* env vars.");
}

module.exports = { buildWelcomeEmailHTML, sendMail };
