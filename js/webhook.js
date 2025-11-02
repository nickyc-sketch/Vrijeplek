
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
/**
 * ENV:
 *  STRIPE_SECRET_KEY
 *  STRIPE_WEBHOOK_SECRET
 *  STRIPE_PRICE_MONTHLY
 *  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let evt;
  try{
    evt = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }catch(err){
    console.error('Invalid signature', err);
    return { statusCode: 400, body: `Webhook Error: ${err.message}`};
  }
  try{
    if (evt.type === 'checkout.session.completed'){
      const session = evt.data.object;
      if (session.mode === 'payment' && session.payment_intent){
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
        if (pi.metadata && pi.metadata.create_subscription_after === 'true' && pi.customer){
          await stripe.subscriptions.create({
            customer: pi.customer,
            items: [{ price: process.env.STRIPE_PRICE_MONTHLY }],
            trial_period_days: 90,
            metadata: { created_from: 'activation_payment' }
          });
        }
      }
    }
    if (evt.type === 'invoice.paid'){
      const invoice = evt.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      if (process.env.SMTP_HOST){
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: customer.email,
          subject: 'Factuur betaald — Vrijeplek.be',
          text: `Bedankt! We hebben uw betaling ontvangen. Factuur: ${invoice.number || invoice.id}`
        });
      }
    }
    return { statusCode: 200, body: 'ok' };
  }catch(err){
    console.error(err);
    return { statusCode: 500, body: 'Internal Error' };
  }
};
