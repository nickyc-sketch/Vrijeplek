// netlify/functions/create-checkout.js
import Stripe from 'stripe';

export const config = { path: '/.netlify/functions/create-checkout' };

export default async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { plan } = await req.json();

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Missing plan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ENV keys
    const sk = process.env.STRIPE_SECRET_KEY;
    const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
    const priceYearly = process.env.STRIPE_PRICE_YEARLY;

    if (!sk || !priceMonthly || !priceYearly) {
      return new Response(JSON.stringify({ error: 'Missing Stripe ENV vars' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stripe = new Stripe(sk, { apiVersion: '2023-10-16' });

    let priceId;
    if (plan === 'monthly') priceId = priceMonthly;
    else if (plan === 'yearly') priceId = priceYearly;
    else {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Detect site origin
    const origin =
      req.headers.get('origin') ||
      process.env.PUBLIC_BASE_URL ||
      'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/payment-success.html`,
      cancel_url: `${origin}/payment-cancelled.html`,
      metadata: { plan }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('create-checkout error', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
