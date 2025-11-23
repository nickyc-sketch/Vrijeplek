export default async (req, context) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 });
    }

    const { prompt } = await req.json().catch(() => ({}));
    if (!prompt || !String(prompt).trim()) {
      return new Response(JSON.stringify({ error: 'no prompt' }), { status: 400 });
    }

    // Sanitize prompt length
    const sanitizedPrompt = String(prompt).trim().substring(0, 1000);


// Bel OpenAI (Node 18 runtime op Netlify). Vervang door officiële SDK indien gewenst.
const r = await fetch('https://api.openai.com/v1/chat/completions', {
method:'POST',
headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
body: JSON.stringify({
model: 'gpt-4o-mini',
messages: [
{role:'system', content:'Je bent een NL copywriter. Antwoord enkel in JSON met keys: about, tagline.'},
{role:'user', content: sanitizedPrompt}
],
temperature: 0.7,
max_tokens: 500
})
});
if(!r.ok){
const t = await r.text();
return new Response(JSON.stringify({error:'openai_fail', detail:t}), {status:500});
}
const j = await r.json();
    const text = j.choices?.[0]?.message?.content || '{}';
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('AI generate error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), { status: 500 });
  }
}
