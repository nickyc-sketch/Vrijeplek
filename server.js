require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const cors = require('cors');
const nodemailer = require('nodemailer');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_EARLY_MONTHLY = process.env.PRICE_EARLY_MONTHLY_ID;
const PRICE_EARLY_YEARLY = process.env.PRICE_EARLY_YEARLY_ID;
const PRICE_REGULAR_MONTHLY = process.env.PRICE_REGULAR_MONTHLY_ID;
const PRICE_REGULAR_YEARLY = process.env.PRICE_REGULAR_YEARLY_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const NO_REPLY_EMAIL = process.env.NO_REPLY_EMAIL || 'noreply@vrijeplek.be';
const COMBELL_SMTP_HOST = process.env.COMBELL_SMTP_HOST;
const COMBELL_SMTP_PORT = Number(process.env.COMBELL_SMTP_PORT || 587);
const COMBELL_SMTP_USER = process.env.COMBELL_SMTP_USER;
const COMBELL_SMTP_PASS = process.env.COMBELL_SMTP_PASS;
const BASE_URL = process.env.BASE_URL || 'https://vrijeplek.be';

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('Missing critical environment variables. Check .env');
}

const stripe = Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const pool = new Pool({ connectionString: DATABASE_URL });

const transporter = nodemailer.createTransport({
  host: COMBELL_SMTP_HOST,
  port: COMBELL_SMTP_PORT,
  secure: COMBELL_SMTP_PORT === 465,
  auth: { user: COMBELL_SMTP_USER, pass: COMBELL_SMTP_PASS }
});

const app = express();
app.use(cors());
app.use(express.json());

// Basic healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Get slots (counter)
app.get('/api/slots', async (req, res) => {
  try {
    const { data } = await supabase.from('counters').select('total,completed,start').eq('id', 1).single();
    const taken = Number((data && data.completed) ?? (data && data.start) ?? 210);
    const total = Number((data && data.total) ?? 3000);
    res.json({ taken, total, start: Number((data && data.start) ?? 210) });
  } catch (err) {
    res.status(500).json({ error: 'failed' });
  }
});

// Create Stripe Checkout Session for subscription (pre-inschrijving)
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const {
      plan, company, firstname, lastname, email, phone, btw,
      street, huisnummer, bus, postcode, gemeente, country, promo
    } = req.body || {};

    if (!email || !plan) return res.status(400).json({ error: 'missing' });

    const { data: counter } = await supabase.from('counters').select('completed,total').eq('id', 1).single();
    const taken = Number((counter && counter.completed) || 0);
    const total = Number((counter && counter.total) || 3000);
    const earlyAvailable = taken < total;

    const priceId = earlyAvailable
      ? (plan === 'yearly' ? PRICE_EARLY_YEARLY : PRICE_EARLY_MONTHLY)
      : (plan === 'yearly' ? PRICE_REGULAR_YEARLY : PRICE_REGULAR_MONTHLY);

    if (!priceId) return res.status(500).json({ error: 'price_id_missing' });

    const TRIAL_END_TS = Math.floor(new Date('2026-06-01T00:00:00Z').getTime() / 1000);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_end: TRIAL_END_TS },
      customer_email: email,
      success_url: `${BASE_URL}/aanmelden?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${BASE_URL}/aanmelden?canceled=true`,
      metadata: {
        plan: plan || '',
        early: earlyAvailable ? '1' : '0',
        promo: promo || '',
        company: company || '',
        firstname: firstname || '',
        lastname: lastname || '',
        phone: phone || '',
        btw: btw || '',
        street: street || '',
        huisnummer: huisnummer || '',
        bus: bus || '',
        postcode: postcode || '',
        gemeente: gemeente || '',
        country: country || ''
      }
    });

    await supabase.from('customers').upsert([{
      session_id: session.id,
      plan,
      early: earlyAvailable,
      company_name: company || null,
      contact_firstname: firstname || null,
      contact_lastname: lastname || null,
      email: email || null,
      phone: phone || null,
      btw_number: btw || null,
      street: street || null,
      huisnummer: huisnummer || null,
      bus: bus || null,
      postcode: postcode || null,
      gemeente: gemeente || null,
      country: country || null,
      status: 'pending',
      created_at: new Date().toISOString()
    }], { onConflict: 'session_id' });

    res.json({ sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

// Generic save endpoint for dashboard profile/settings
app.post('/api/save-profile', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.email && !data.session_id) return res.status(400).json({ error: 'missing identifiers' });

    await supabase.from('customers').upsert([{
      session_id: data.session_id || null,
      stripe_customer_id: data.stripe_customer_id || null,
      email: data.email || null,
      company_name: data.company || null,
      contact_firstname: data.firstname || null,
      contact_lastname: data.lastname || null,
      phone: data.phone || null,
      btw_number: data.btw || null,
      street: data.street || null,
      huisnummer: data.huisnummer || null,
      bus: data.bus || null,
      postcode: data.postcode || null,
      gemeente: data.gemeente || null,
      country: data.country || null,
      status: data.status || 'active',
      updated_at: new Date().toISOString()
    }], { onConflict: 'session_id' });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'save_failed' });
  }
});

// A small endpoint to store arbitrary settings (if your dashboard uses it)
app.post('/api/save-settings', async (req, res) => {
  try {
    const { key, value, owner } = req.body || {};
    if (!key || owner == null) return res.status(400).json({ error: 'missing' });

    const { error } = await supabase.from('settings').upsert([{
      owner,
      key,
      value,
      updated_at: new Date().toISOString()
    }], { onConflict: ['owner', 'key'] });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'save_failed' });
  }
});

// Stripe webhook
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const sessionId = session.id;
    const email = session.customer_details?.email || session.customer_email || null;
    const plan = (session.metadata && session.metadata.plan) || null;
    const earlyFlag = (session.metadata && session.metadata.early === '1');

    try {
      await supabase.from('customers').upsert([{
        session_id: sessionId,
        stripe_customer_id: session.customer || null,
        email: email || null,
        plan: plan || null,
        early: earlyFlag,
        status: 'active',
        updated_at: new Date().toISOString()
      }], { onConflict: 'session_id' });

      const client = await pool.connect();
      try {
        const result = await client.query('UPDATE public.counters SET completed = completed + 1 WHERE id = 1 AND completed < total RETURNING completed');
        const row = result.rows[0];
        if (row && row.completed !== null) {
          if (email && COMBELL_SMTP_HOST && COMBELL_SMTP_USER) {
            const subject = earlyFlag ? 'Welkom bij Vrijeplek — bedankt!' : 'Welkom bij Vrijeplek';
            const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0b1624">
              <h1>Bedankt</h1>
              <p>Je inschrijving is bevestigd. Eerste afschrijving op 01-06-2026.</p>
              </div>`;
            await transporter.sendMail({ from: `Vrijeplek <${NO_REPLY_EMAIL}>`, to: email, subject, html, text: 'Bedankt. Eerste afschrijving op 01-06-2026.' });
          }
        }
      } catch (pgErr) {
      } finally {
        client.release();
      }
    } catch (err) {
    }
  }

  res.json({ received: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {});
