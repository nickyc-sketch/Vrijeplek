export default async (req, context) => {
try{
const { prompt } = await req.json();
if(!prompt) return new Response(JSON.stringify({error:'no prompt'}), {status:400});


// Bel OpenAI (Node 18 runtime op Netlify). Vervang door officiële SDK indien gewenst.
const r = await fetch('https://api.openai.com/v1/chat/completions', {
method:'POST',
headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
body: JSON.stringify({
model: 'gpt-4o-mini',
messages: [
{role:'system', content:'Je bent een NL copywriter. Antwoord enkel in JSON met keys: about, tagline.'},
{role:'user', content: prompt}
],
temperature: 0.7
})
});
if(!r.ok){
const t = await r.text();
return new Response(JSON.stringify({error:'openai_fail', detail:t}), {status:500});
}
const j = await r.json();
const text = j.choices?.[0]?.message?.content || '{}';
return new Response(text, {status:200, headers:{'Content-Type':'application/json'}});
}catch(err){
return new Response(JSON.stringify({error:err.message}), {status:500});
}
}
