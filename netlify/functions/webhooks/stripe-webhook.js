// netlify/functions/stripe-webhook.js
import Stripe from 'stripe';

export async function handler(event) {
  const sig = event.headers['stripe-signature'];
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Missing STRIPE envs' };
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  // Netlify geeft body als string door – nodig voor signature verify
  const body = event.body;

  let evt;
  try {
    evt = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (evt.type === 'checkout.session.completed' || evt.type === 'invoice.paid') {
      const obj = evt.data.object;

      // E-mail vastleggen
      const email =
        obj.customer_email ||
        obj.customer_details?.email ||
        obj?.customer?.email ||
        '';

      // Plan uit metadata (indien beschikbaar)
      const plan =
        obj.metadata?.plan ||
        (obj.lines?.data?.[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly');

      // Zet account actief in jouw profielopslag
      // We roepen hier je bestaande profile-function aan met POST
      try {
        await fetch(process.env.SITE_URL + '/.netlify/functions/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            account_status: 'active',
            plan: plan || 'monthly',
            stripe_customer: obj.customer || null,
            stripe_session: obj.id || null
          })
        });
      } catch (e) {
        console.error('Kon profile-update niet posten:', e);
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('webhook handler error:', err);
    return { statusCode: 500, body: 'server error' };
  }
}
