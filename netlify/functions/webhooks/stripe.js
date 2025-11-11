// netlify/functions/webhooks/stripe.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try{
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }catch(err){
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if(event.type==='checkout.session.completed'){
    const email = event.data.object.customer_details?.email || event.data.object.customer_email;
    const plan = event.data.object.metadata?.plan || 'monthly';
    if(email){
      await supabase.from('accounts').upsert({ email, plan, status:'active' }, { onConflict:'email' });
    }
  }

  return res.json({ received:true });
}
