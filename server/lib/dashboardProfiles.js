const DASHBOARD_PROFILE_IDS = [
  'admin', 'lab-analyze', 'lab-config', 'lab-head', 'lab-inventory',
  'qc-staff', 'qc-reviewer', 'qc-head', 'viewer',
];

function isValidProfileId(id) {
  if (id === null || id === undefined || id === '') return true; // unset
  return typeof id === 'string' && DASHBOARD_PROFILE_IDS.includes(id);
}

module.exports = { DASHBOARD_PROFILE_IDS, isValidProfileId };
