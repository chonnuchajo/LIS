const { isOllamaAvailable, OLLAMA_BASE_URL } = require('../ollamaClient');

describe('ollamaClient', () => {
  test('OLLAMA_BASE_URL is a string starting with http', () => {
    expect(typeof OLLAMA_BASE_URL).toBe('string');
    expect(OLLAMA_BASE_URL).toMatch(/^http/);
  });

  test('isOllamaAvailable returns a boolean', async () => {
    const result = await isOllamaAvailable();
    expect(typeof result).toBe('boolean');
  }, 5000);
});
