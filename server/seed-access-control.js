// Syncs the access-control configuration (groups + roles) into whatever
// MongoDB this server is connected to. Each machine has its own local
// LIS-DB, so config set on a dev machine does not reach the server — run
// this on the server once to bring it in line.
//
//   node seed-access-control.js            apply changes
//   node seed-access-control.js --dry-run  preview only, write nothing
//
// Users are intentionally never touched — those are created by real logins.
// To change what gets applied, edit the GROUPS / ROLES blocks below.

require('dotenv').config();
const mongoose = require('mongoose');
const AccessGroup = require('./models/AccessGroup');
const Role = require('./models/Role');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const DRY_RUN = process.argv.includes('--dry-run');

const GROUPS = [
  { id: 'others', name: 'อื่นๆ', description: '', paths: [], locked: true, sortOrder: 999 },
  { id: 'qc', name: 'QC', description: '', paths: ['/physical-inspection', '/qc-approval'], locked: false, sortOrder: 1778742461866 },
  { id: 'lab', name: 'Lab', description: '', paths: ['/record-results', '/daily-check', '/stock-deduction', '/petitions/assign'], locked: false, sortOrder: 1778742461876 },
  { id: 'inventory', name: 'Inventory', description: '', paths: ['/master-items', '/stock'], locked: false, sortOrder: 1778742461886 },
];

const ROLES = [
  { id: 'admin', name: 'Administrator', description: 'Full system access', locked: true, permissions: ['others', 'qc', 'lab', 'inventory'] },
  { id: 'lab', name: 'Lab Analyst', description: 'Sample handling and result entry', locked: false, permissions: ['/record-results', '/daily-check', '/stock-deduction', '/petitions/assign', '/master-items', '/stock'] },
  { id: 'qc', name: 'QC Reviewer', description: 'Review and approve results', locked: false, permissions: ['inventory', '/physical-inspection'] },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access to dashboards and reports', locked: false, permissions: ['/home', '/', '/petitions'] },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI}${DRY_RUN ? '  (DRY RUN — no writes)' : ''}\n`);

  const desiredGroupIds = GROUPS.map((g) => g.id);
  const staleGroups = await AccessGroup.find({ id: { $nin: desiredGroupIds } }).lean();

  console.log('Groups to upsert:', desiredGroupIds.join(', '));
  console.log('Stale groups to remove:', staleGroups.map((g) => g.id).join(', ') || 'none');
  console.log('Roles to upsert:', ROLES.map((r) => r.id).join(', '));

  if (DRY_RUN) {
    console.log('\nDry run — nothing written.');
    await mongoose.disconnect();
    return;
  }

  for (const group of GROUPS) {
    await AccessGroup.updateOne({ id: group.id }, { $set: group }, { upsert: true });
  }
  if (staleGroups.length) {
    await AccessGroup.deleteMany({ id: { $nin: desiredGroupIds } });
  }
  for (const role of ROLES) {
    await Role.updateOne({ id: role.id }, { $set: role }, { upsert: true });
  }

  console.log(`\nDone. ${GROUPS.length} groups upserted, ${staleGroups.length} removed, ${ROLES.length} roles upserted.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
