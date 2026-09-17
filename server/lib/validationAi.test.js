const { validateInput, validateOutput, runValidationAi } = require('./validationAi');
const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey; });
test('rejects empty, oversized and external-image inputs before provider calls', () => {
  expect(() => validateInput({ mode: 'review', text: '' })).toThrow();
  expect(() => validateInput({ mode: 'review', text: 'a'.repeat(30001) })).toThrow();
  expect(() => validateInput({ mode: 'extract', image: 'https://example.com/image.png' })).toThrow();
  expect(validateInput({ mode: 'review', text: 'Actual = 0.5028975 mg/mL' }).text).toContain('0.5028975');
});
test('output rejects malformed rows and embedded row delimiters', () => {
  expect(() => validateOutput({ summary: '', warnings: [], rows: [['1\n2']] })).toThrow();
  expect(() => validateOutput({ summary: '', warnings: [], rows: [null] })).toThrow();
  expect(validateOutput({ summary: 'ร่าง', warnings: [], rows: [['0.50', '']] }).rows).toEqual([['0.50', '']]);
});
test('reuses server key with strict structured output and rejects truncated results', async () => {
  process.env.OPENAI_API_KEY = 'test-key-not-real';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) });
  await expect(runValidationAi({ mode: 'review', text: 'test' })).rejects.toThrow('ครบ');
  const request = global.fetch.mock.calls[0][1];
  expect(request.headers.Authorization).toBe('Bearer test-key-not-real');
  expect(JSON.parse(request.body)).toMatchObject({ store: false, response_format: { type: 'json_schema', json_schema: { strict: true } } });
});
test('returns validated result and never echoes provider failure details', async () => {
  process.env.OPENAI_API_KEY = 'test-key-not-real';
  const output = { summary: 'ตรวจหน่วย', warnings: ['ข้อมูลยังไม่ครบ'], rows: [] };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }) });
  await expect(runValidationAi({ mode: 'review', text: 'test' })).resolves.toEqual(output);
  global.fetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'private provider data' });
  await expect(runValidationAi({ mode: 'review', text: 'test' })).rejects.not.toThrow('private');
});
