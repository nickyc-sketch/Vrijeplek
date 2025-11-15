// netlify/functions/stripe-webhook.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';

export async function handler(event) {
  const sig = event.headers['stripe-signature'];

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('Missing STRIPE envs');
    return { statusCode: 500, body: 'Missing STRIPE envs' };
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  const body = event.body;

  let evt;
  try {
    evt = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    const type = evt.type;
    const obj = evt.data.object;

    // 1) PROFIEL UPDATEN (zoals je al had)
    try {
      const email =
        obj.customer_email ||
        obj.customer_details?.email ||
        obj?.customer?.email ||
        '';

      const plan =
        obj.metadata?.plan ||
        (obj.lines?.data?.[0]?.price?.recurring?.interval === 'year'
          ? 'yearly'
          : 'monthly');

      if (email) {
        await fetch(process.env.SITE_URL + '/.netlify/functions/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            account_status: 'active',
            plan: plan || 'monthly',
            stripe_customer: obj.customer || null,
            stripe_session: obj.id || null,
          }),
        });
      }
    } catch (e) {
      console.error('Kon profile-update niet posten:', e);
    }

    // 2) FACTUURMAIL VERSTUREN BIJ BETAALDE FACTUUR
    if (type === 'invoice.paid' || type === 'invoice.payment_succeeded') {
      const invoice = obj; // zelfde als evt.data.object
      const customerId = invoice.customer;

      let customer = null;
      try {
        if (customerId) {
          customer = await stripe.customers.retrieve(customerId);
        }
      } catch (e) {
        console.warn('Kon klant niet ophalen:', e.message);
      }

      const customerEmail =
        invoice.customer_email ||
        customer?.email ||
        obj.customer_details?.email;

      if (!customerEmail) {
        console.warn('Geen e-mailadres gevonden voor invoice', invoice.id);
      } else if (process.env.SMTP_HOST) {
        // Nodemailer transport (zelfde setup als je test-mail)
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const amountEuro = ((invoice.amount_paid || invoice.total || 0) / 100).toFixed(2);
        const invoiceNumber = invoice.number || invoice.id;
        const invoiceUrl =
          invoice.hosted_invoice_url || invoice.invoice_pdf || '';

        const customerName =
          customer?.name ||
          invoice.customer_name ||
          invoice.customer_email ||
          'klant';

        const supportEmail = process.env.SMTP_FROM || 'info@vrijeplek.be';

        // --- HTML template invullen ---
        let html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><title>Bedankt voor je betaling — Vrijeplek</title></head>
<body style="margin:0;padding:0;background:#f3f4fb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.15);">
<tr>
  <td style="background:linear-gradient(135deg,#1a66ff,#3b82f6);padding:18px 24px;color:#fff;">
    <div style="font-size:20px;font-weight:700;">Vrijeplek</div>
    <div style="font-size:13px;opacity:.85;">Bevestiging van je betaling</div>
  </td>
</tr>
<tr>
<td style="padding:24px 24px 8px;color:#0f172a;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Hi ${customerName},</p>
  <p style="margin:0 0 12px;">
    Bedankt voor je betaling bij <strong>Vrijeplek</strong>.
    Je factuur met nummer <strong>${invoiceNumber}</strong> voor
    <strong>€ ${amountEuro}</strong> is succesvol voldaan.
  </p>
  <p style="margin:0 0 12px;">
    In de bijlage vind je de officiële factuur in PDF-vorm.
    Je kan je factuur ook online bekijken via deze link:
  </p>
  <p style="margin:0 0 18px;">
    <a href="${invoiceUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#1a66ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
      Bekijk factuur
    </a>
  </p>
  <p style="margin:0 0 12px;">
    Heb je nog vragen over je abonnement of over deze factuur?
    Antwoord gerust op deze e-mail of contacteer ons via
    <a href="mailto:${supportEmail}" style="color:#1a66ff;text-decoration:none;">${supportEmail}</a>.
  </p>
  <p style="margin:0 0 4px;">Met vriendelijke groet,</p>
  <p style="margin:0 0 18px;">
    Het Vrijeplek-team<br>
    <span style="font-size:13px;color:#6b7280;">www.vrijeplek.be</span>
  </p>
</td>
</tr>
<tr>
<td style="padding:14px 24px 18px;background:#f9fafb;color:#9ca3af;font-size:11px;text-align:center;">
  Je ontvangt deze mail omdat je een betaling hebt gedaan bij Vrijeplek.
  Bewaar deze factuur goed voor je administratie.
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;

        const attachments = [];
        if (invoice.invoice_pdf) {
          attachments.push({
            filename: `factuur-vrijeplek-${invoiceNumber}.pdf`,
            path: invoice.invoice_pdf, // Stripe public invoice PDF URL
          });
        }

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: customerEmail,
          subject: `Factuur betaald — Vrijeplek (${invoiceNumber})`,
          html,
          text:
            `Bedankt voor je betaling bij Vrijeplek.\n` +
            `Factuur: ${invoiceNumber}\n` +
            `Bedrag: € ${amountEuro}\n\n` +
            `Je kan je factuur bekijken via: ${invoiceUrl}\n\n` +
            `Vragen? Mail naar ${supportEmail}.`,
          attachments,
        });

        console.log('Factuurmail verzonden naar', customerEmail);
      } else {
        console.warn('SMTP_HOST ontbreekt: geen factuurmail verzonden.');
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('webhook handler error:', err);
    return { statusCode: 500, body: 'server error' };
  }
}
