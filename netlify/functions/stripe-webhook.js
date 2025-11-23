import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  // LAAT DIT STAAN
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const email = session.customer_details?.email;
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    if (!email) {
      console.log('Geen e-mail in checkout.session.completed');
      return { statusCode: 200, body: 'No email on session' };
    }

    const lowerEmail = email.toLowerCase();

    // 1. Zoek Supabase user op basis van email
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('email', lowerEmail)
      .single();

    if (userErr) {
      console.log('Fout bij zoeken user:', userErr.message);
    }

    if (!user) {
      console.log('Geen Supabase user gevonden voor', lowerEmail);
    } else {
      // 2. Activeer gebruiker in Supabase (users)
      const { error: updUserErr } = await supabase
        .from('users')
        .update({
          is_active: true,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscribed_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updUserErr) {
        console.log('Fout bij updaten users:', updUserErr.message);
      } else {
        console.log('Gebruiker geactiveerd in users:', lowerEmail);
      }
    }

    // 3. Zet ook het profiel op actief in "profiles"
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        {
          email: lowerEmail,
          account_status: 'active',
          plan: 'monthly'
        },
        { onConflict: 'email' }
      );

    if (profileErr) {
      console.log('Fout bij upsert profiles:', profileErr.message);
    } else {
      console.log('Profiel geactiveerd in profiles:', lowerEmail);
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
