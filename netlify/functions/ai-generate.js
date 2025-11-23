const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'AI service not configured' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // Sanitize prompt length
    const sanitizedPrompt = String(prompt).trim().substring(0, 1000);


    // Call OpenAI API
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Je bent een NL copywriter. Antwoord enkel in JSON met keys: about, tagline.' },
          { role: 'user', content: sanitizedPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('OpenAI API error:', t);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'openai_fail', detail: t })
      };
    }

    const j = await r.json();
    const text = j.choices?.[0]?.message?.content || '{}';

    // Basic sanitization of AI output
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { about: text.substring(0, 1000), tagline: '' };
    }

    const sanitized = {
      about: typeof parsed.about === 'string' ? parsed.about.substring(0, 1000) : '',
      tagline: typeof parsed.tagline === 'string' ? parsed.tagline.substring(0, 200) : ''
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(sanitized)
    };
  } catch (err) {
    console.error('AI generate error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
  }
}
