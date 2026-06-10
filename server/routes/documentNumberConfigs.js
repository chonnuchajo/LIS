const express = require('express');
const router = express.Router();
const DocumentNumberConfig = require('../models/DocumentNumberConfig');
const { DEFAULTS, DOC_TYPES, validateDocNumberConfig } = require('../lib/documentNumber');

function pick(doc) {
  return {
    docType: doc.docType,
    prefix: doc.prefix || '',
    yearFormat: doc.yearFormat,
    includeMonth: doc.includeMonth,
    seqPadding: doc.seqPadding,
    separator: doc.separator == null ? '' : doc.separator,
  };
}

// GET /api/document-number-config — always returns all 3 docTypes (DB doc or default).
router.get('/', async (req, res) => {
  try {
    const docs = await DocumentNumberConfig.find().lean();
    const byType = new Map(docs.map((d) => [d.docType, d]));
    const data = DOC_TYPES.map((t) => {
      const d = byType.get(t);
      return d ? pick(d) : { ...DEFAULTS[t] };
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/document-number-config/:docType — validate + upsert one docType.
router.put('/:docType', async (req, res) => {
  try {
    const { docType } = req.params;
    if (!DOC_TYPES.includes(docType)) {
      return res.status(400).json({ error: 'docType ไม่ถูกต้อง' });
    }
    const body = req.body || {};
    const input = {
      prefix: typeof body.prefix === 'string' ? body.prefix : '',
      yearFormat: body.yearFormat,
      includeMonth: !!body.includeMonth,
      seqPadding: Number(body.seqPadding),
      separator: typeof body.separator === 'string' ? body.separator : '',
    };
    const err = validateDocNumberConfig(input);
    if (err) return res.status(400).json({ error: err });

    const doc = await DocumentNumberConfig.findOneAndUpdate(
      { docType },
      { docType, ...input },
      { new: true, upsert: true },
    ).lean();
    res.json({ data: pick(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
