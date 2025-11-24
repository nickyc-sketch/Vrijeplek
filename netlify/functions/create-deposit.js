// netlify/functions/create-deposit.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

function supa() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function baseUrl(event) {
  return event.headers.origin ||
    event.headers.referer?.split('/').slice(0, 3).join('/') ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.APP_BASE_URL ||
    'http://localhost:8888';
}

async function sendBookingEmails({ klantEmail, klantNaam, providerEmail }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured, skipping booking emails.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'Vrijeplek <no-reply@vrijeplek.be>';

  if (klantEmail) {
    await transporter.sendMail({
      from,
      to: klantEmail,
      subject: 'Bevestiging van je boeking — Vrijeplek',
      html: `<p>Beste ${klantNaam || 'klant'},</p>
             <p>Je boeking is bevestigd.</p>
             <p>Tot snel!</p>
             <p>Het Vrijeplek-team</p>`
    });
  }

  if (providerEmail) {
    await transporter.sendMail({
      from,
      to: providerEmail,
      subject: 'Nieuwe boeking via Vrijeplek',
      html: `<p>Je hebt een nieuwe boeking ontvangen via Vrijeplek.</p>
             <p>Klant: ${klantNaam || klantEmail || 'Onbekend'}</p>`
    });
  }
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const { slotId, customer_email, customer_name } = JSON.parse(event.body || '{}');

    if (!slotId || !customer_email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'slotId_and_customer_email_required' })
      };
    }

    const client = supa();

    // 1) Slot ophalen
    const { data: slot, error: slotErr } = await client
      .from('slots')
      .select('id, email, date, from, to, desc, status')
      .eq('id', slotId)
      .maybeSingle();

    if (slotErr || !slot) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'slot_not_found' })
      };
    }

    if (slot.status && slot.status !== 'open') {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: 'slot_not_available' })
      };
    }

    // 2) Profiel van aanbieder ophalen
    const providerEmail = (slot.email || '').toLowerCase();
    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('zaak, deposit_enabled, deposit_amount, iban, email')
      .eq('email', providerEmail)
      .maybeSingle();

    if (profErr || !profile) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'provider_profile_not_found' })
      };
    }

    const zaakName = profile.zaak || profile.email || 'Vrijeplek partner';
    const useDeposit = !!profile.deposit_enabled && Number(profile.deposit_amount) > 0;
    const depositAmount = useDeposit ? Number(profile.deposit_amount) : 0;

    // 3) Als geen voorschot: gewoon booking registreren, geen Stripe
    if (!useDeposit) {
      // markeer slot als geboekt
      await client
        .from('slots')
        .update({
          status: 'booked',
          booked_at: new Date().toISOString()
        })
        .eq('id', slot.id);

      try {
        await sendBookingEmails({
          klantEmail: customer_email,
          klantNaam: customer_name,
          providerEmail
        });
      } catch (mailErr) {
        console.error('Failed to send booking emails (no deposit):', mailErr);
      }

      // eventueel hier in aparte "bookings" tabel schrijven, nu laten we het basic
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          mode: 'no_deposit',
          message: 'Afspraak geboekt zonder voorschot.'
        })
      };
    }

    // 4) Mét voorschot: Stripe Checkout aanmaken
    const amountCents = Math.round(depositAmount * 100);
    const origin = baseUrl(event);

    const successUrl = `${origin}/payment-success.html?booking=success&slot_id=${slotId}`;
    const cancelUrl = `${origin}/payment-cancelled.html?booking=cancel&slot_id=${slotId}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'bancontact', 'ideal'],
      customer_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amountCents,
            product_data: {
              name: `Voorschot afspraak bij ${zaakName}`,
              description: `Tijdslot: ${slot.date} ${slot.from}–${slot.to}`
            }
          }
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'deposit',
        slot_id: slot.id,
        provider_email: providerEmail,
        klant_email: customer_email,
        klant_naam: customer_name || ''
      }
    });

    // Mark slot as booked BEFORE creating checkout (race condition prevention)
    const { error: updateErr } = await client
      .from('slots')
      .update({
        status: 'pending_deposit',
        stripe_checkout_session_id: session.id
      })
      .eq('id', slot.id);

    if (updateErr) {
      console.error('Failed to mark slot as booked:', updateErr);
      // Continue anyway - webhook will handle it
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, mode: 'deposit', url: session.url })
    };
  } catch (e) {
    console.error('create-deposit error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'server_error', message: String(e?.message || e) })
    };
  }
}
