// netlify/functions/create-checkout.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req, res) => {
  if(req.method!=='POST') return res.status(405).json({ error:'method_not_allowed' });
  try{
    const { email, plan } = req.body||{};
    const price = (plan==='yearly') ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
    if(!email || !price) return res.status(400).json({ error:'missing_email_or_price' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price, quantity:1 }],
      success_url: `${process.env.SITE_URL}/geactiveerd.html?paid=1`,
      cancel_url: `${process.env.SITE_URL}/dashboard.html?payment=cancelled`,
      metadata: { email, plan }
    });

    return res.json({ url: session.url });
  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}
