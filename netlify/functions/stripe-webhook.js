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

  // Handle subscription checkout (signup payment)
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    const email = session.customer_details?.email;
    const subscriptionId = session.subscription;
    const customerId = session.customer;
    const metadata = session.metadata || {};

    if (!email) {
      console.log('Geen e-mail in checkout.session.completed');
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ received: true, note: 'No email on session' }) };
    }

    const lowerEmail = email.toLowerCase();

    // Check if this is a subscription (signup) or deposit payment
    if (metadata.type === 'deposit') {
      // Handle deposit payment - slot is already marked as booked in create-deposit
      // Just log it for now, could add booking confirmation email here
      console.log('Deposit payment completed for slot:', metadata.slot_id);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ received: true, type: 'deposit' }) };
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
