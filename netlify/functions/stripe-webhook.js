import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !to) {
    console.warn('SMTP not configured or missing recipient, skipping email.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'Vrijeplek <no-reply@vrijeplek.be>',
    to,
    subject,
    html,
  });
}

export async function handler(event) {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    if (!sig) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing stripe-signature header' })
      };
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Webhook secret not configured' })
      };
    }

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Invalid webhook signature:', err);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
      };
    }

    // Handle subscription checkout (signup payment)
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;

      const email = session.customer_details?.email;
      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const metadata = session.metadata || {};

      if (!email) {
        console.log('Geen e-mail in checkout.session.completed');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ received: true, note: 'No email on session' })
        };
      }

      const lowerEmail = email.toLowerCase();

      // Check if this is a subscription (signup) or deposit payment
      if (metadata.type === 'deposit') {
        const slotId = metadata.slot_id;
        const providerEmail = metadata.provider_email;
        const klantEmail = metadata.klant_email;
        const klantNaam = metadata.klant_naam || 'klant';

        try {
          await supabase
            .from('slots')
            .update({ status: 'booked', booked_at: new Date().toISOString() })
            .eq('id', slotId);
        } catch (slotErr) {
          console.error('Failed to update slot after deposit:', slotErr);
        }

        try {
          if (klantEmail) {
            await sendEmail({
              to: klantEmail,
              subject: 'Bevestiging van je boeking — Vrijeplek',
              html: `<p>Beste ${klantNaam},</p>
                     <p>Je voorschotbetaling is ontvangen en je afspraak is bevestigd.</p>
                     <p>Tot snel!</p>
                     <p>Het Vrijeplek-team</p>`
            });
          }
          if (providerEmail) {
            await sendEmail({
              to: providerEmail,
              subject: 'Nieuwe boeking via Vrijeplek',
              html: `<p>Je hebt een nieuwe boeking ontvangen via Vrijeplek.</p>
                     <p>Klant: ${klantNaam} (${klantEmail || 'onbekend'})</p>`
            });
          }
        } catch (mailErr) {
          console.error('Failed to send booking emails:', mailErr);
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ received: true, type: 'deposit' })
        };
      }

      // Handle subscription signup
      const plan = metadata.plan || 'monthly';

      // 1. Try to find Supabase user by email (if users table exists)
      try {
        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', lowerEmail)
          .maybeSingle();

        if (!userErr && user) {
          // Update user if found
          await supabase
            .from('users')
            .update({
              is_active: true,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscribed_at: new Date().toISOString()
            })
            .eq('id', user.id);
          console.log('Gebruiker geactiveerd in users:', lowerEmail);
        }
      } catch (err) {
        // users table might not exist, that's okay
        console.log('Users table not found or error:', err.message);
      }

      // 2. Always update/activate profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(
          {
            email: lowerEmail,
            account_status: 'active',
            plan: plan === 'yearly' ? 'yearly' : 'monthly'
          },
          { onConflict: 'email' }
        );

      if (profileErr) {
        console.log('Fout bij upsert profiles:', profileErr.message);
      } else {
        console.log('Profiel geactiveerd in profiles:', lowerEmail, 'plan:', plan);
      }

      // 3. STUUR MAIL ALLEEN NA GESLAAGDE BETALING (abonnement geactiveerd)
      try {
        const planLabel =
          plan === 'yearly'
            ? 'je jaarabonnement (€180/jaar)'
            : 'je maandabonnement (€19,95/maand)';

        await sendEmail({
          to: lowerEmail,
          subject: 'Je Vrijeplek-abonnement is actief',
          html: `
            <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;color:#0f172a;line-height:1.6;">
              <div style="max-width:560px;margin:0 auto;padding:16px 12px;">
                <div style="border-radius:16px;border:1px solid rgba(148,163,184,.5);padding:20px;background:linear-gradient(180deg,#f9fafb,#eff6ff);">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <div style="width:32px;height:32px;border-radius:999px;background:radial-gradient(circle at 30% 20%,#fff 0,#b3e0ff 18%,transparent 40%),radial-gradient(circle at 80% 80%,#0f5bff 0,#001d5c 55%);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:18px;">V</div>
                    <div style="display:flex;flex-direction:column;line-height:1.1;">
                      <span style="font-weight:700;color:#0f172a;">vrijeplek</span>
                      <span style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#64748b;">last minute afspreken</span>
                    </div>
                  </div>

                  <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">
                    Bedankt, we hebben je betaling ontvangen.
                  </p>
                  <p style="margin:0 0 8px;">
                    Goed nieuws: <strong>${planLabel}</strong> is nu actief. Je Vrijeplek-account is gekoppeld aan dit e-mailadres.
                  </p>

                  <p style="margin:0 0 8px;">
                    Een bevestigingsmail werd zonet verstuurd naar je mailbox. Van daaruit kan je inloggen en je eerste vrije momenten online zetten.
                  </p>

                  <p style="margin:0 0 8px;">
                    <strong>Facturatie &amp; Peppol</strong><br>
                    Je facturen worden via Peppol verstuurd op basis van je opgegeven bedrijfs- en facturatiegegevens.
                    Controleer straks in je dashboard of je <em>Peppol-gegevens</em> correct zijn ingevuld, zodat alles netjes toekomt.
                  </p>

                  <p style="margin:0 0 10px;">
                    Je kan nu meteen naar je dashboard gaan en je eerste vrije plekken publiceren:
                  </p>

                  <p style="margin:0 0 10px;">
                    <a href="https://vrijeplek.be/dashboard" style="display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#1a66ff,#0056ff);color:#fff;text-decoration:none;font-weight:600;">
                      Ga naar je dashboard
                    </a>
                  </p>

                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    Lukt er iets niet of klopt er iets niet met je gegevens? Antwoord op deze mail en we helpen je verder.
                  </p>
                </div>
              </div>
            </div>
          `
        });

        console.log('Abonnement-mail verzonden naar:', lowerEmail, 'plan:', plan);
      } catch (mailErr) {
        console.error('Fout bij versturen abonnement-mail:', mailErr);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true })
    };
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
