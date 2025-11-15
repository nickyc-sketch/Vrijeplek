// netlify/functions/webhook.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

/**
 * ENV:
 *  STRIPE_SECRET_KEY
 *  STRIPE_WEBHOOK_SECRET
 *  STRIPE_PRICE_MONTHLY
 *  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *  SUPABASE_URL
 *  SUPABASE_SERVICE_ROLE_KEY   // service role key, NIET de anon key
 */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function markUserActiveFromSession(session) {
  // Verwacht metadata: user_id + plan
  const meta = session.metadata || {};
  const userId = meta.user_id;
  const plan = meta.plan || 'monthly';

  const customerId = session.customer || null;
  const subscriptionId = session.subscription || null;

  if (!userId) {
    console.warn('Geen user_id in session.metadata, skip Supabase update');
    return;
  }

  const update = {
    plan_status: 'active',
    plan_type: plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan_activated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId);

  if (error) {
    console.error('Supabase update error (checkout.session.completed):', error);
  }
}

async function updateStatusFromSubscription(sub) {
  const customerId = sub.customer;
  if (!customerId) return;

  const { data: row, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !row) {
    console.warn('Geen profiel gevonden voor customer', customerId, error);
    return;
  }

  const status =
    sub.status === 'active' || sub.status === 'trialing'
      ? 'active'
      : 'canceled';

  const { error: updErr } = await supabase
    .from('profiles')
    .update({
      plan_status: status,
      stripe_subscription_id: sub.id,
    })
    .eq('id', row.id);

  if (updErr) {
    console.error('Supabase update error (subscription):', updErr);
  }
}

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let evt;

  try {
    evt = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Invalid signature', err);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (evt.type) {
      case 'checkout.session.completed': {
        const session = evt.data.object;

        // Bestaande logica: bij een eenmalige betaling toch een subscription starten
        if (session.mode === 'payment' && session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(
            session.payment_intent
          );

          if (
            pi.metadata &&
            pi.metadata.create_subscription_after === 'true' &&
            pi.customer
          ) {
            const sub = await stripe.subscriptions.create({
              customer: pi.customer,
              items: [{ price: process.env.STRIPE_PRICE_MONTHLY }],
              trial_period_days: 90,
              metadata: { created_from: 'activation_payment' },
            });

            // Ook status in Supabase zetten (indien user_id in metadata zit)
            await updateStatusFromSubscription(sub);
          }
        }

        // Nieuwe logica: direct Supabase updaten op basis van metadata (user_id + plan)
        await markUserActiveFromSession(session);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = evt.data.object;
        await updateStatusFromSubscription(sub);
        break;
      }

      case 'invoice.paid': {
        const invoice = evt.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);

        // Optioneel: extra zekerheid — als er een actieve subscription gekoppeld is:
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          await updateStatusFromSubscription(sub);
        }

        // Bestaande mail-logica
        if (process.env.SMTP_HOST) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: customer.email,
            subject: 'Factuur betaald — Vrijeplek.be',
            text: `Bedankt! We hebben uw betaling ontvangen. Factuur: ${
              invoice.number || invoice.id
            }`,
          });
        }
        break;
      }

      default:
        // andere events nu negeren
        break;
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Internal Error' };
  }
};
