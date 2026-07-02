const CATEGORIES = new Set(['insecticide', 'herbicide', 'fertilizer', 'solvent', 'imported']);
const THAI = /[฀-๿]/;

function validateEntries(entries) {
  const errors = [];
  if (!Array.isArray(entries)) return { ok: false, errors: ['top-level value must be an array'] };
  const seen = new Map();
  entries.forEach((e, i) => {
    const at = `#${i}`;
    if (!e || typeof e !== 'object') { errors.push(`${at}: entry must be an object`); return; }
    const { commonName, thaiName, category, sgMin, sgMax, note } = e;
    if (typeof commonName !== 'string' || !commonName.trim()) errors.push(`${at}: commonName must be a non-empty string`);
    else {
      if (THAI.test(commonName)) errors.push(`${at}: commonName contains Thai characters: "${commonName}"`);
      if (commonName !== commonName.toUpperCase()) errors.push(`${at}: commonName must be uppercase: "${commonName}"`);
      const key = commonName.trim().toLowerCase();
      if (seen.has(key)) errors.push(`${at}: duplicate commonName "${commonName}" (also ${seen.get(key)})`);
      else seen.set(key, at);
    }
    if (typeof thaiName !== 'string' || !thaiName.trim()) errors.push(`${at}: thaiName must be a non-empty string`);
    if (!CATEGORIES.has(category)) errors.push(`${at}: category "${category}" not in ${[...CATEGORIES].join('/')}`);
    if (sgMin !== null && typeof sgMin !== 'number') errors.push(`${at}: sgMin must be a number or null`);
    if (sgMax !== null && typeof sgMax !== 'number') errors.push(`${at}: sgMax must be a number or null`);
    if (typeof sgMin === 'number' && typeof sgMax === 'number' && sgMin > sgMax) errors.push(`${at}: sgMin (${sgMin}) > sgMax (${sgMax})`);
    if (note !== undefined && typeof note !== 'string') errors.push(`${at}: note must be a string`);
  });
  return { ok: errors.length === 0, errors };
}

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', 'data', 'product-density-ranges.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (err) { console.error(`❌ cannot read/parse ${file}: ${err.message}`); process.exit(1); }
  const { ok, errors } = validateEntries(data);
  if (!ok) { console.error(`❌ ${errors.length} error(s):`); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
  console.log(`✅ ${data.length} entries valid.`);
}

module.exports = { validateEntries };
