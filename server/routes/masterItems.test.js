const express = require('express');
const http = require('http');

jest.mock('../models/MasterItemMeta', () => ({
  find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
}));

function jsonResponse(payload, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: jest.fn().mockResolvedValue(payload),
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  });
}

function makeApp() {
  jest.resetModules();
  const router = require('./masterItems');
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

async function request(app, path) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    return await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path, method: 'GET' },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                body: body ? JSON.parse(body) : null,
              });
            } catch (err) {
              reject(err);
            }
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

describe('masterItems route', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('GET /common-names returns grouped common names before /:id fallback', async () => {
    global.fetch
      .mockReturnValueOnce(jsonResponse([
        { item_no: 'FG-001', common_name: 'DIURON 80% WP + HEXAZINONE 13.2% SL' },
        { item_no: 'FG-002', common_name: 'DIURON 80% WP' },
        { item_no: 'RM-001', item_name2: 'ABAMECTIN 1.8% EC' },
        { item_no: 'FG-003', common_name: 'CYMOXANIL (MIX A+B)' },
      ]))
      .mockReturnValueOnce(jsonResponse([
        { item_no: 'LDI-001', commonName: 'HEXAZINONE 13.2% SL' },
      ]));

    const res = await request(makeApp(), '/common-names');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { key: 'abamectin 1.8% ec', commonName: 'ABAMECTIN 1.8% EC', itemCount: 1, itemNos: ['RM-001'] },
      { key: 'cymoxanil (mix a+b)', commonName: 'CYMOXANIL (MIX A+B)', itemCount: 1, itemNos: ['FG-003'] },
      { key: 'diuron 80% wp', commonName: 'DIURON 80% WP', itemCount: 2, itemNos: ['FG-001', 'FG-002'] },
      { key: 'hexazinone 13.2% sl', commonName: 'HEXAZINONE 13.2% SL', itemCount: 2, itemNos: ['FG-001', 'LDI-001'] },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
