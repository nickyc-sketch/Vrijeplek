// netlify/functions/signup.js
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

async function makeCheckoutLink(email, plan){
  const r = await fetch(`${process.env.SITE_URL}/.netlify/functions/create-checkout`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, plan })
  });
  const d = await r.json();
  if(!r.ok) throw new Error(d.error||'checkout_failed');
  return d.url;
}

export default async (req, res) => {
  if(req.method!=='POST') return res.status(405).json({ error:'method_not_allowed' });
  try{
    const { email, password, company, btw, plan } = req.body||{};
    if(!email || !password || !plan) return res.status(400).json({ error:'missing_fields' });

    // 1) User aanmaken (Supabase stuurt bevestigingsmail)
    const { data, error:signErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm:false, user_metadata:{ company, btw, plan }
    });
    if(signErr) return res.status(400).json({ error:signErr.message });

    // 2) Accounts status => pending
    const { error:accErr } = await supabase.from('accounts')
      .upsert({ email, plan, status:'pending', company, btw }, { onConflict:'email' });
    if(accErr) return res.status(400).json({ error:accErr.message });

    // 3) Betaallink genereren
    const payUrl = await makeCheckoutLink(email, plan);

    // 4) Transactie-mail met betaallink
    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>Welkom bij Vrijeplek</h2>
        <p>1) Bevestig eerst je e-mail via de mail van Vrijeplek.</p>
        <p>2) Rond daarna je inschrijving af via je gekozen abonnement:</p>
        <p><a href="${payUrl}" style="display:inline-block;padding:12px 18px;background:#1a66ff;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Betaal je abonnement</a></p>
        <p>Gekozen plan: <strong>${plan==='yearly'?'€180/jaar':'€19,25/maand'}</strong></p>
      </div>
    `;
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Vrijeplek <no-reply@vrijeplek.be>',
      to: email,
      subject: 'Rond je inschrijving af — Vrijeplek',
      html
    });

    return res.json({ ok:true });
  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}
