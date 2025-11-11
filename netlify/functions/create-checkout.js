// netlify/functions/create-checkout.js
import Stripe from 'stripe';

export async function handler(event) {
  try {
    // Debug/healthcheck: GET /.netlify/functions/create-checkout?ping=1
    if (event.httpMethod === 'GET') {
      const ok = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY);
      return {
        statusCode: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok,
          has_SECRET: !!process.env.STRIPE_SECRET_KEY,
          has_PRICE_MONTHLY: !!process.env.STRIPE_PRICE_MONTHLY,
          has_PRICE_YEARLY: !!process.env.STRIPE_PRICE_YEARLY,
          site_url: process.env.SITE_URL || null
        })
      };
    }

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: ''
      };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { plan = 'monthly', email = '' } = JSON.parse(event.body || '{}');

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const PRICE_MONTHLY     = process.env.STRIPE_PRICE_MONTHLY; // bv. price_123
    const PRICE_YEARLY      = process.env.STRIPE_PRICE_YEARLY;  // bv. price_abc
    const SITE_URL          = process.env.SITE_URL || 'https://www.vrijeplek.be';

    if (!STRIPE_SECRET_KEY || !PRICE_MONTHLY || !PRICE_YEARLY) {
      return {
        statusCode: 500,
        headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
        body: JSON.stringify({ error: 'Missing Stripe env vars', details: {
          has_SECRET: !!STRIPE_SECRET_KEY, has_PRICE_MONTHLY: !!PRICE_MONTHLY, has_PRICE_YEARLY: !!PRICE_YEARLY
        }})
      };
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const price = plan === 'yearly' ? PRICE_YEARLY : PRICE_MONTHLY;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/geactiveerd.html?cs={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/dashboard.html?cancelled=1`,
      metadata: { plan }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('create-checkout error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' },
      body: JSON.stringify({ error: 'Stripe failed', message: String(err?.message || err) })
    };
  }
}
