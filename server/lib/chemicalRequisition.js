// Pure helpers for chemical (solvent) requisition — no DB, unit-tested.

const todayStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// StockTransaction note that records which machine got the solvent.
const buildDeductNote = (instrumentName, note) =>
  `เบิกให้ ${instrumentName || '-'}${note ? ` — ${note}` : ''}`;

// Validate + normalize a POST body. Returns { error } or { value }.
function normalizeReqInput(body) {
  const b = body || {};
  const qty = Number(b.qty);
  if (!b.solventId) return { error: 'solventId ต้องระบุ' };
  if (!b.instrumentId) return { error: 'instrumentId ต้องระบุ' };
  if (!Number.isInteger(qty) || qty <= 0) return { error: 'จำนวนต้องเป็นจำนวนเต็มบวก' };
  const rb = b.requestedBy || {};
  return {
    value: {
      roomSlug: String(b.roomSlug || 'analysis'),
      date: b.date ? String(b.date) : todayStr(),
      instrumentId: String(b.instrumentId),
      instrumentName: b.instrumentName ? String(b.instrumentName) : '',
      solventId: String(b.solventId),
      qty,
      note: b.note ? String(b.note) : '',
      requestedBy: {
        email: rb.email ? String(rb.email) : '',
        name: rb.name ? String(rb.name) : '',
      },
    },
  };
}

module.exports = { todayStr, buildDeductNote, normalizeReqInput };
