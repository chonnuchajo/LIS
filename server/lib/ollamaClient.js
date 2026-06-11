const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://192.168.51.21:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * generate — send prompt to Ollama, wait for full response (non-streaming)
 */
async function generate(prompt, options = {}) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: options.temperature ?? 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
  const data = await res.json();
  return data.response ?? '';
}

/**
 * generateStream — stream tokens from Ollama via NDJSON
 * @param {string} prompt
 * @param {(chunk: string) => void} onChunk
 */
async function generateStream(prompt, onChunk, options = {}) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? OLLAMA_MODEL,
      prompt,
      stream: true,
      options: { temperature: options.temperature ?? 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama stream failed: ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.response) onChunk(json.response);
      } catch {
        // incomplete JSON chunk — skip
      }
    }
  }
}

module.exports = { isOllamaAvailable, generate, generateStream, OLLAMA_BASE_URL, OLLAMA_MODEL };
