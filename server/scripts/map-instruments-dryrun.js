// Dry-run: fetch live master items, apply the GC/HPLC reference, report coverage.
// Does NOT touch the database.
'use strict';

const { mapItem, canon } = require('./map-instruments-lib');

const MASTER_URL = 'https://n8n-plant.icpladda.com/webhook/API/Item-production';
const COMMON_KEYS = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];

function getCommonName(item) {
  for (const k of COMMON_KEYS) {
    const v = item && item[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

(async () => {
  const res = await fetch(MASTER_URL);
  const items = await res.json();
  console.log('master items fetched:', items.length);

  let totalGroups = 0;
  const groups = new Map(); // commonName(lower) -> { commonName, itemNos:[] }
  for (const it of items) {
    const cn = getCommonName(it);
    if (!cn) continue;
    const key = cn.toLowerCase();
    if (!groups.has(key)) groups.set(key, { commonName: cn, itemNos: [] });
    const ino = it.item_no || it.itemNo || it.item_code || it.code;
    if (ino) groups.get(key).itemNos.push(ino);
  }
  totalGroups = groups.size;

  let fullyMapped = 0, partial = 0, none = 0, comboHit = 0, hasBoth = 0;
  const unmatchedTokens = new Map();
  const bothTokens = new Map();
  const sampleFull = [], samplePartial = [];

  for (const g of groups.values()) {
    const r = mapItem(g.commonName);
    const filled = r.instruments.filter((x) => x === 'GC' || x === 'HPLC').length;
    const total = r.instruments.length;
    if (r.status === 'combo') comboHit++;
    const reasons = r.status.split(',');
    reasons.forEach((reason, i) => {
      const tok = canon(r.tokens[i] || '');
      if (reason === 'unmatched' && tok) unmatchedTokens.set(tok, (unmatchedTokens.get(tok) || 0) + 1);
      if (reason === 'both' && tok) bothTokens.set(tok, (bothTokens.get(tok) || 0) + 1);
    });
    if (filled === total && total > 0) { fullyMapped++; if (sampleFull.length < 8) sampleFull.push(`${g.commonName} -> [${r.instruments.join(',')}]`); }
    else if (filled > 0) { partial++; if (samplePartial.length < 8) samplePartial.push(`${g.commonName} -> [${r.instruments.join(',')}] (tokens: ${r.tokens.join(' | ')})`); }
    else { none++; }
    if (r.instruments.some((x) => x === '') && reasons.includes('both')) hasBoth++;
  }

  console.log('\n=== COVERAGE (by distinct commonName group) ===');
  console.log('total groups        :', totalGroups);
  console.log('fully mapped        :', fullyMapped);
  console.log('partially mapped    :', partial);
  console.log('not mapped at all   :', none);
  console.log('combo-rule hits     :', comboHit);
  console.log('groups w/ BOTH slot :', hasBoth);

  console.log('\n=== sample FULLY mapped ===');
  sampleFull.forEach((s) => console.log(' ', s));
  console.log('\n=== sample PARTIAL ===');
  samplePartial.forEach((s) => console.log(' ', s));

  const sortDesc = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\n=== BOTH tokens (left blank, need manual choice) ===');
  sortDesc(bothTokens).forEach(([t, c]) => console.log(`  ${t}: ${c} groups`));

  console.log('\n=== UNMATCHED tokens (top 60, refine ALIAS/reference) ===');
  sortDesc(unmatchedTokens).slice(0, 60).forEach(([t, c]) => console.log(`  ${t}: ${c} groups`));
  console.log('\ntotal distinct unmatched tokens:', unmatchedTokens.size);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
