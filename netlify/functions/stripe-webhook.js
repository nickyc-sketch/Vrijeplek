import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // LAAT DIT STAAN
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const email = session.customer_details.email;
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    // 1. Zoek Supabase user op basis van email
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) {
      console.log("Geen Supabase user gevonden voor", email);
      return { statusCode: 200, body: 'No user found' };
    }

    // 2. Activeer gebruiker in Supabase
    await supabase
      .from('users')
      .update({
        is_active: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscribed_at: new Date().toISOString()
      })
      .eq('id', user.id);

    console.log("Gebruiker geactiveerd:", email);
  }

  return { statusCode: 200, body: 'ok' };
}
