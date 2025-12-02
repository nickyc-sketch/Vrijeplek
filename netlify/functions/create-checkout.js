// netlify/functions/create-checkout.js
import Stripe from 'stripe';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { plan } = body;

    if (!plan || (plan !== 'monthly' && plan !== 'yearly')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid plan. Must be "monthly" or "yearly".' })
      };
    }

    // ENV keys
    const sk = process.env.STRIPE_SECRET_KEY;
    const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
    const priceYearly = process.env.STRIPE_PRICE_YEARLY;

    if (!sk || !priceMonthly || !priceYearly) {
      console.error('Missing Stripe environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing Stripe ENV vars' })
      };
    }

    const stripe = new Stripe(sk, { apiVersion: '2023-10-16' });

    const priceId = plan === 'monthly' ? priceMonthly : priceYearly;

    // Detect site origin
    const origin =
      event.headers.origin ||
      event.headers.referer?.split('/').slice(0, 3).join('/') ||
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/geactiveerd.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/waarom.html?cancel=1`,
      metadata: { plan: String(plan).substring(0, 200) }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('create-checkout error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(err?.message || err) })
    };
  }
}
