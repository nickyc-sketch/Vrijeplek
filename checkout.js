// netlify/functions/checkout.js
import Stripe from 'stripe';

export const config = { path: '/.netlify/functions/checkout' };

export default async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.json().catch(() => ({}));

    const {
      plan,
      company,
      vat,
      category,
      email,
      phone,
      reviews,
      address,
      bio,
    } = body || {};

    if (!plan) {
      return new Response(
        JSON.stringify({ error: 'Missing plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Missing email' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ENV-vars zoals in je README
    const sk = process.env.STRIPE_SECRET_KEY;
    const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
    const priceYearly = process.env.STRIPE_PRICE_YEARLY;
    const activationPrice = process.env.STRIPE_PRICE_ACTIVATION || null;
    const successUrl = process.env.SUCCESS_URL;
    const cancelUrl = process.env.CANCEL_URL;

    if (!sk || !priceMonthly || !priceYearly || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({
          error:
            'Missing Stripe env vars. Check STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, SUCCESS_URL, CANCEL_URL',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(sk, { apiVersion: '2023-10-16' });

    let priceId;
    if (plan === 'monthly') priceId = priceMonthly;
    else if (plan === 'yearly') priceId = priceYearly;
    else {
      return new Response(
        JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Basis-subscription + optionele activatie-fee
    const line_items = [{ price: priceId, quantity: 1 }];

    if (activationPrice) {
      line_items.unshift({ price: activationPrice, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items,
      success_url: successUrl, // uit ENV, bv. login.html?success=1
      cancel_url: cancelUrl,   // uit ENV, bv. signup.html?cancel=1
      customer_email: email,
      metadata: {
        plan,
        company: company || '',
        vat: vat || '',
        category: category || '',
        phone: phone || '',
        reviews: reviews || '',
        address: address || '',
        bio: bio || '',
      },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('checkout error', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
