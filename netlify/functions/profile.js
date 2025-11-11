// netlify/functions/profile.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Tabel: profiles(email pk, zaak, telefoon, btw, cat, straat, postcode, website, bio)

export default async (req, res) => {
  try{
    if(req.method==='GET'){
      const email = (req.query.email||'').toLowerCase();
      if(!email) return res.status(400).json({ error:'missing_email' });

      const { data: prof } = await supabase.from('profiles').select('*').eq('email', email).single();
      const { data: acc }  = await supabase.from('accounts').select('plan,status').eq('email', email).single();

      return res.json({
        ...(prof||{}),
        plan: acc?.plan || 'monthly',
        account_status: acc?.status || 'pending'
      });
    }

    if(req.method==='POST'){
      const b = req.body||{};
      if(!b.email) return res.status(400).json({ error:'missing_email' });
      const payload = {
        email: b.email.toLowerCase(),
        zaak: b.zaak || null,
        telefoon: b.telefoon || null,
        btw: b.btw || null,
        cat: b.cat || null,
        straat: b.straat || null,
        postcode: b.postcode || null,
        website: b.website || null,
        bio: b.bio || null
      };
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict:'email' });
      if(error) return res.status(400).json({ error:error.message });
      return res.json({ ok:true });
    }

    return res.status(405).json({ error:'method_not_allowed' });
  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}
