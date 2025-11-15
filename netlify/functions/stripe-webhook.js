// netlify/functions/stripe-webhook.js

import Stripe from 'stripe';
import nodemailer from 'nodemailer';

// 1) Stripe client
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// 2) Mail "transporter" (jouw SMTP verbinding)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // 587 = TLS via STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function handler(event) {
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    // 3) Controleer dat de webhook écht van Stripe komt
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  try {
    // 4) Alleen reageren op "invoice.paid"
    if (stripeEvent.type === 'invoice.paid') {
      const invoice = stripeEvent.data.object;

      // Probeer e-mail te vinden
      let email =
        invoice.customer_email ||
        invoice.customer_details?.email ||
        '';

      // Indien nodig: klant nog even ophalen
      if (!email && invoice.customer) {
        const customer = await stripe.customers.retrieve(invoice.customer);
        email = customer.email || email;
      }

      if (email) {
        const customerName =
          invoice.customer_name ||
          invoice.customer_details?.name ||
          'ondernemer';

        // 5) HIER sturen we de mail — dit is die ene regel die je vroeg
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: 'Bedankt voor je betaling – Vrijeplek',
          html: `
            <!doctype html>
            <html lang="nl">
            <head>
              <meta charset="utf-8">
              <title>Vrijeplek factuur</title>
              <style>
                body{margin:0;padding:0;font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f5f7fb;color:#0f172a;}
                .wrap{max-width:640px;margin:0 auto;padding:28px 16px;}
                .card{background:#ffffff;border-radius:16px;padding:24px 22px 26px;box-shadow:0 18px 40px rgba(15,23,42,.12);}
                h1{font-size:20px;margin:0 0 12px;}
                p{font-size:14px;line-height:1.6;margin:0 0 10px;}
                .brand{font-weight:700;color:#1a66ff;}
                .footer{margin-top:20px;font-size:12px;color:#6b7280;}
              </style>
            </head>
            <body>
              <div class="wrap">
                <div class="card">
                  <p class="brand">Vrijeplek</p>
                  <h1>Bedankt voor je betaling!</h1>
                  <p>Beste ${customerName},</p>
                  <p>We hebben je betaling voor je Vrijeplek-abonnement succesvol ontvangen.</p>
                  <p>Je factuur bevindt zich in bijlage of in je account op Vrijeplek.be.</p>
                  <p>Mocht je nog vragen hebben, dan kan je ons altijd bereiken via <a href="mailto:info@vrijeplek.be">info@vrijeplek.be</a>.</p>
                  <p>Met vriendelijke groeten,<br>Het Vrijeplek-team</p>
                </div>
                <p class="footer">
                  Deze e-mail werd automatisch verstuurd na een succesvolle betaling in het Vrijeplek-systeem.
                </p>
              </div>
            </body>
            </html>
          `,
          // attachments: [...] // komt later, voor PDF
        });

        console.log('✔ Mail verzonden naar', email);
      } else {
        console.log('Geen e-mailadres gevonden voor invoice', invoice.id);
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('webhook handler error:', err);
    return { statusCode: 500, body: 'server error' };
  }
}
