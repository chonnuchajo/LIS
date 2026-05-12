require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Machine = require('../models/Machine');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';
const SEED_PATH = path.join(__dirname, '..', 'data', 'machines-seed.json');

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected:', MONGODB_URI);
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
    const ops = seed.map((m) => ({
      updateOne: { filter: { code: m.code }, update: { $setOnInsert: m }, upsert: true },
    }));
    const result = await Machine.bulkWrite(ops);
    console.log('inserted:', result.upsertedCount, 'matched:', result.matchedCount, 'total:', seed.length);
    const count = await Machine.countDocuments();
    console.log('machines in DB:', count);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
