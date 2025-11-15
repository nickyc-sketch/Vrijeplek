// netlify/functions/stripe-webhook.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ENV die je nodig hebt in Netlify:
// STRIPE_SECRET_KEY
// STRIPE_WEBHOOK_SECRET
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY   (NIET de anon key!)

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Hulpfunctie: user actief zetten in Supabase
async function activateUserFromSession(session) {
  const meta = session.metadata || {};
  const userId = meta.user_id || null;          // Supabase user id
  const plan = meta.plan || 'monthly';          // 'monthly' of 'yearly'
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
    .from('profiles')               // ← tabelnaam: pas aan als jij iets anders gebruikt
    .update(update)
    .eq('id', userId);

  if (error) {
    console.error('Supabase update fout (checkout.session.completed):', error);
  }
}

// Hulpfunctie: status bijwerken op subscription events
async function updateStatusFromSubscription(sub) {
  const customerId = sub.customer;
  if (!customerId) return;

  const { data: row, error } = await supabase
    .from('profiles')               // idem: tabelnaam
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
    console.error('Supabase update fout (subscription):', updErr);
  }
}

export async function handler(event) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Missing STRIPE envs' };
  }

  const sig = event.headers['stripe-signature'];
  const body = event.body; // Netlify geeft string

  let evt;
  try {
    evt = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    switch (evt.type) {
      case 'checkout.session.completed': {
        const session = evt.data.object;
        // Supabase bijwerken op basis van metadata
        await activateUserFromSession(session);
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

        // als je hier later nog mails of extra logica wil doen, kan dat
        // hier roepen we ook nog updateStatusFromSubscription aan voor zekerheid
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          await updateStatusFromSubscription(sub);
        }
        break;
      }

      default:
        // andere events negeren we voorlopig
        break;
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('webhook handler error:', err);
    return { statusCode: 500, body: 'server error' };
  }
}
