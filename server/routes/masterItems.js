const express = require('express');

const router = express.Router();

const DEFAULT_WEBHOOK_URL = 'https://n8n-plant.icpladda.com/webhook/api/itme-all';
const WEBHOOK_URL = process.env.MASTER_ITEMS_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;

async function forwardToWebhook(req, res) {
  try {
    const headers = {
      Accept: 'application/json',
    };

    const init = {
      method: req.method,
      headers,
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body || {});
    }

    const target = new URL(WEBHOOK_URL);
    if (req.params.id && !target.searchParams.has('id')) {
      target.searchParams.set('id', req.params.id);
    }
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => target.searchParams.append(key, entry));
      } else if (value !== undefined) {
        target.searchParams.set(key, value);
      }
    }

    const response = await fetch(target, init);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        message: 'Master item webhook request failed',
        error: payload,
      });
    }

    return res.status(response.status).json(payload);
  } catch (err) {
    return res.status(502).json({
      message: 'Cannot connect to master item webhook',
      error: err.message,
    });
  }
}

router.get('/', forwardToWebhook);
router.post('/', forwardToWebhook);
router.put('/', forwardToWebhook);
router.patch('/', forwardToWebhook);
router.delete('/', forwardToWebhook);
router.get('/:id', forwardToWebhook);
router.put('/:id', forwardToWebhook);
router.patch('/:id', forwardToWebhook);
router.delete('/:id', forwardToWebhook);

module.exports = router;
