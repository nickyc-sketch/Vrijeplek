
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
/**
 * ENV:
 *  STRIPE_SECRET_KEY
 *  STRIPE_PRICE_MONTHLY (recurring €9)
 *  STRIPE_PRICE_YEARLY  (recurring €80)
 *  STRIPE_PRICE_ACTIVATION (one-time €9)
 *  SUCCESS_URL, CANCEL_URL
 */
exports.handler = async (event) => {
  try{
    const data = JSON.parse(event.body || '{}');
    const plan = data.plan || 'monthly';
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.company,
      metadata: {
        plan,
        vat: data.vat || '',
        category: data.category || '',
        phone: data.phone || '',
        reviews: data.reviews || '',
        address: data.address || '',
        bio: (data.bio || '').slice(0,240),
        source: 'vrijeplek-signup'
      }
    });
    if (plan === 'yearly'){
      const session = await stripe.checkout.sessions.create({
        mode:'subscription',
        customer: customer.id,
        line_items:[{ price: process.env.STRIPE_PRICE_YEARLY, quantity:1 }],
        success_url: process.env.SUCCESS_URL || '/login.html?success=1',
        cancel_url: process.env.CANCEL_URL || '/signup.html?cancel=1'
      });
      return { statusCode:200, body: JSON.stringify({ url: session.url }) };
    } else {
      const session = await stripe.checkout.sessions.create({
        mode:'payment',
        customer: customer.id,
        line_items:[{ price: process.env.STRIPE_PRICE_ACTIVATION, quantity:1 }],
        success_url: process.env.SUCCESS_URL || '/login.html?success=1',
        cancel_url: process.env.CANCEL_URL || '/signup.html?cancel=1',
        payment_intent_data:{ metadata:{ create_subscription_after:'true', plan:'monthly' } }
      });
      return { statusCode:200, body: JSON.stringify({ url: session.url }) };
    }
  }catch(err){
    console.error(err);
    return { statusCode:500, body: JSON.stringify({ error: err.message }) };
  }
};
