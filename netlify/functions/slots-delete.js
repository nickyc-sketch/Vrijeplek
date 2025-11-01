
const fetch = require('node-fetch');
exports.handler = async (event) => {
  try{
    const body = JSON.parse(event.body||'{}');
    const id = body.id;
    await fetch(process.env.SUPABASE_URL + '/rest/v1/slots?id=eq.'+encodeURIComponent(id), {
      method:'DELETE',
      headers:{ 'apikey':process.env.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+process.env.SUPABASE_ANON_KEY }
    });
    return { statusCode:200, body:'ok' };
  }catch(e){ return { statusCode:500, body: JSON.stringify({error:e.message})}; }
};
