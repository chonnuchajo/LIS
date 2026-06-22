const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function isOpenAIConfigured() {
  return Boolean(OPENAI_API_KEY);
}

async function generateStream(prompt, onChunk, options = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI stream failed: ${response.status} ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

// Non-streaming call that forces a JSON object response (OpenAI JSON mode).
// Returns the parsed object. Throws on transport error or unparseable output.
async function generateJSON(prompt, options = {}) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || OPENAI_MODEL,
      messages: [
        ...(options.system ? [{ role: 'system', content: options.system }] : []),
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1800,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return JSON.parse(content);
}

module.exports = { isOpenAIConfigured, generateStream, generateJSON, OPENAI_MODEL };
