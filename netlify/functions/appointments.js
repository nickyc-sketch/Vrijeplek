// netlify/functions/appointments.js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Tabel: appointments(id uuid pk default uuid_generate_v4(), date text, time text, client text, purpose text, note text)

export default async (req, res) => {
  try{
    const action = (req.method==='GET') ? (req.query.action||'list') : (req.body?.action||'');
    if(action==='list'){
      const { data, error } = await supabase.from('appointments').select('*').order('date').order('time');
      if(error) return res.status(400).json({ error:error.message });
      return res.json(data||[]);
    }
    if(action==='publish-slot'){
      const { date, from, to, desc } = req.body||{};
      if(!date||!from||!to) return res.status(400).json({ error:'missing_fields' });
      const { error } = await supabase.from('appointments').insert([{ date, time: from, client:'—', purpose:desc||'', note:'' }]);
      if(error) return res.status(400).json({ error:error.message });
      return res.json({ ok:true });
    }
    if(action==='update'){
      const { id, date, time, client, purpose, note } = req.body||{};
      if(!id) return res.status(400).json({ error:'missing_id' });
      const { error } = await supabase.from('appointments').update({ date, time, client, purpose, note }).eq('id', id);
      if(error) return res.status(400).json({ error:error.message });
      return res.json({ ok:true });
    }
    if(action==='delete'){
      const { id } = req.body||{};
      if(!id) return res.status(400).json({ error:'missing_id' });
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if(error) return res.status(400).json({ error:error.message });
      return res.json({ ok:true });
    }
    return res.status(400).json({ error:'unknown_action' });
  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}
