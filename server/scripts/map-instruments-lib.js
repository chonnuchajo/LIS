// Reference data + matching logic for mapping GC/HPLC instruments to substances,
// derived from the two method ODS files:
//   "วิธีวิเคราะห์ GC.ods"   -> sheet "29-01-69" (newest)
//   "วิธีวิเคราะห์ HPLC.ods" -> sheet "Sheet1"
'use strict';

// ---- substance parsing (mirrors src/lib/substances.ts) ----
function parseSubstances(commonName) {
  const parts = String(commonName || '').split('+').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [String(commonName || '').trim()].filter(Boolean);
  if (parts.length <= 2) return parts;
  while (parts.length > 2) {
    let shortestIdx = 0;
    for (let i = 1; i < parts.length; i += 1) {
      if (parts[i].length < parts[shortestIdx].length) shortestIdx = i;
    }
    let neighborIdx;
    if (shortestIdx === 0) neighborIdx = 1;
    else if (shortestIdx === parts.length - 1) neighborIdx = shortestIdx - 1;
    else neighborIdx = parts[shortestIdx - 1].length <= parts[shortestIdx + 1].length
      ? shortestIdx - 1 : shortestIdx + 1;
    const lo = Math.min(shortestIdx, neighborIdx);
    const hi = Math.max(shortestIdx, neighborIdx);
    parts.splice(lo, hi - lo + 1, parts[lo] + ' + ' + parts[hi]);
  }
  return parts;
}
function extractSubstanceName(raw) {
  const t = String(raw || '').trim();
  return t ? (t.split(/\s+/)[0] || '') : '';
}
function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/[.,]+$/g, '').replace(/\s+/g, ' ');
}

// alias: variant spelling (normalized) -> canonical token. Applied to ods + master tokens.
const ALIAS = {
  acetameprid: 'acetamiprid',
  imidachloprid: 'imidacloprid',
  brodifacum: 'brodifacoum',
  pyrasosulfuron: 'pyrazosulfuron',
  pyriphoxyfen: 'pyriproxyfen',
  pyriproxifen: 'pyriproxyfen',
  kazukamycin: 'kasugamycin',
  cypermetrin: 'cypermethrin',
  deltametrin: 'deltamethrin',
  hexaconazol: 'hexaconazole',
  propiconazol: 'propiconazole',
  tebuconazol: 'tebuconazole',
  difenoconazol: 'difenoconazole',
  metribucin: 'metribuzin',
  acetachlor: 'acetochlor',
  anilophos: 'anilofos',
  'lamda-cyhalothrin': 'lambda-cyhalothrin',
  'lamda-cyhalotrin': 'lambda-cyhalothrin',
  'lambda-cyhalotrin': 'lambda-cyhalothrin',
  'cyhalofob-butyl': 'cyhalofop-butyl',
  azoxy: 'azoxystrobin',
  imazaryl: 'imazalil',
  kresoxim: 'kresoxim-methyl',
  '2,4': '2,4-d',
  '24d': '2,4-d',
  '2,4-': '2,4-d',
  // master-side spelling variants for real actives
  chlorpyrifos: 'chlorpyriphos',
  'bispyribac-sodium': 'bispyribac',
  'glufosinate-ammonium': 'glufosinate',
  profenofos: 'profenophos',
  pendimethalin: 'pendimethaline',
  'bensulfuron-methyl': 'bensulfuron',
  // 2,4-D butyl ester is GC-specific (vs amine salts which are HPLC)
};
function canon(token) {
  const n = norm(token);
  return ALIAS[n] || n;
}

// canonical single-substance reference (already canonical spelling)
const GC_SINGLE = ['2,4-d', 'acetochlor', 'alachlor', 'alpha-cypermethrin', 'ametryn',
  'amitraz', 'atrazine', 'anilofos', 'bifenthrin', 'bromacil', 'buprofezin', 'butachlor',
  'captan', 'carbaryl', 'carbosulfan', 'chlorothalonil', 'clomazone', 'chlorpyriphos',
  'cyhalofop-butyl', 'cypermethrin', 'deltamethrin', 'dichlorvos', 'ethion', 'etofenprox',
  'fenitrothion', 'fenvalerate', 'fenobucarb', 'fluazifop-p-butyl', 'haloxyfop-p-methyl',
  'hexaconazole', 'imazalil', 'lambda-cyhalothrin', 'malathion', 'metalaxyl', 'metaldehyde',
  'metribuzin', 'metolachlor', 'oxadiazon', 'paclobutrazol', 'permethrin', 'pirimiphos-methyl',
  'profenophos', 'propanil', 'prochloraz', 'propiconazole', 'propoxur', 'pendimethaline',
  'propamocarb', 'pretilachlor', 'pyridaben', 'quinalphos', 'quizalofop-p-ethyl', 'tetradifon',
  'trifluralin', 'triazophos', 'tricyclazole', 'triadimefon', 'tebuconazole',
  '2,4-d-butyl', '2,4-d-be', '2,4-d-ibe'].map(canon);

const HPLC_SINGLE = ['2,4-d', 'abamectin', 'acetamiprid', 'bispyribac', 'bromadiolone',
  'brodifacoum', 'carbendazim', 'carbofuran', 'cartap', 'clomazone', 'chlorpyriphos',
  'cymoxanil', 'difenoconazole', 'dimethoate', 'diflubenzuron', 'difethialone',
  'fenoxaprop-p-ethyl', 'diuron', 'emamectin', 'fipronil', 'gibberellic', 'glyphosate',
  'iprodione', 'imidacloprid', 'kasugamycin', 'lufenuron', 'methomyl', 'omethoate', 'paraquat',
  'pyrazosulfuron', 'temephos', 'validamycin', 'dimethomorph', 'quinclorac', 'kresoxim-methyl',
  'fomesafen', 'carbaryl', 'azoxystrobin', 'glufosinate', 'pymetrozine', 'chlorfenapyr',
  'mcpa', 'thiamethoxam', 'spirodiclofen', 'mesotrione', 'mefenacet', 'pyriproxyfen',
  'diquat'].map(canon);

const gcSet = new Set(GC_SINGLE);
const hplcSet = new Set(HPLC_SINGLE);
// substances genuinely analyzable on either instrument -> left blank for manual choice
const BOTH = new Set([...gcSet].filter((t) => hplcSet.has(t)));

// combos: a combination is analyzed together on ONE instrument.
function comboKey(tokens) { return tokens.map(canon).sort().join(' + '); }
const COMBO = {};
[['2,4-d', 'anilofos'], ['2,4-d', 'butachlor'], ['anilofos', 'propanil'],
  ['clomazone', 'propanil'], ['epoxiconazole', 'prochloraz'], ['propanil', 'butachlor'],
  ['propiconazole', 'prochloraz'],
  // 2,4-D butyl ester combos (GC)
  ['2,4-d-butyl', 'anilofos'], ['2,4-d-butyl', 'butachlor']].forEach((c) => { COMBO[comboKey(c)] = 'GC'; });
[['quinclorac', 'bensulfuron'], ['hexazinone', 'diuron'], ['mesotrione', 'atrazine'],
  ['chlorantraniliprole', 'lambda-cyhalothrin'], ['nicosulfuron', 'mesotrione', 'atrazine'],
  ['picloram', '2,4-d'], ['fumioxazin', 'glufosinate']].forEach((c) => { COMBO[comboKey(c)] = 'HPLC'; });

function lookupSingle(token) {
  const c = canon(token);
  // BOTH = usable on either instrument -> stored as 'BOTH' (user picks at assign time)
  if (BOTH.has(c)) return { inst: 'BOTH', reason: 'both' };
  if (gcSet.has(c)) return { inst: 'GC', reason: 'gc' };
  if (hplcSet.has(c)) return { inst: 'HPLC', reason: 'hplc' };
  return { inst: '', reason: 'unmatched' };
}

// Map one master-item common_name -> positional instruments aligned to substances.
function mapItem(commonName) {
  const substances = parseSubstances(commonName);
  const tokens = substances.map(extractSubstanceName);
  if (substances.length > 1) {
    const key = comboKey(tokens);
    if (COMBO[key]) {
      return { instruments: substances.map(() => COMBO[key]), substances, tokens, status: 'combo' };
    }
  }
  const results = tokens.map(lookupSingle);
  return {
    instruments: results.map((r) => r.inst),
    substances,
    tokens,
    status: results.map((r) => r.reason).join(','),
  };
}

module.exports = {
  parseSubstances, extractSubstanceName, norm, canon, mapItem, lookupSingle,
  gcSet, hplcSet, BOTH, COMBO,
};
