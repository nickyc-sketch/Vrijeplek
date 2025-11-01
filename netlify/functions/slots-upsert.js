
const fetch = require('node-fetch');
exports.handler = async (event) => {
  try{
    const body = JSON.parse(event.body||'{}');
    const row = { when: body.when, status: body.status||'Vrij' };
    const res = await fetch(process.env.SUPABASE_URL + '/rest/v1/slots', {
      method:'POST',
      headers:{ 'apikey':process.env.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+process.env.SUPABASE_ANON_KEY, 'Content-Type':'application/json', 'Prefer':'return=representation' },
      body: JSON.stringify(row)
    });
    const data = await res.json();
    return { statusCode:200, body: JSON.stringify(data) };
  }catch(e){ return { statusCode:500, body: JSON.stringify({error:e.message})}; }
};
