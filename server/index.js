require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/LIS-DB';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve uploaded QC photos as static assets
app.use('/LIS/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function mountApi(path, router) {
  app.use(`/api${path}`, router);
  app.use(`/LIS/api${path}`, router);
}

// API Routes
mountApi('/samples', require('./routes/samples'));
mountApi('/auth', require('./routes/auth'));
mountApi('/physical-results', require('./routes/physicalResults'));
mountApi('/approvals', require('./routes/approvals'));
mountApi('/densities', require('./routes/densities'));
mountApi('/stock', require('./routes/stock'));
mountApi('/access-control', require('./routes/accessControl'));
mountApi('/petitions', require('./routes/petitions'));
mountApi('/lab-requests', require('./routes/labRequests'));
mountApi('/sample-receipts', require('./routes/sampleReceipts'));
mountApi('/employees', require('./routes/employees'));
mountApi('/master-items', require('./routes/masterItems'));
mountApi('/master-item-meta', require('./routes/masterItemMeta'));
mountApi('/simple-methods', require('./routes/simpleMethods'));
mountApi('/standard-configs', require('./routes/standardConfigs'));
mountApi('/standard-overrides', require('./routes/standardOverrides'));
mountApi('/simple-method-exclusions', require('./routes/simpleMethodExclusions'));
mountApi('/machines', require('./routes/machines'));
mountApi('/parameters', require('./routes/parameters'));
mountApi('/qc-results', require('./routes/qcResults'));
mountApi('/uploads', require('./routes/uploads'));
mountApi('/daily-checks', require('./routes/dailyChecks'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.get('/LIS/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

// Serve React build if dist folder exists
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use('/LIS', express.static(distPath));
  // SPA fallback: serve index.html for all /LIS routes (handles browser refresh)
  app.get(['/LIS/*'], (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

function loadAllModels() {
  const modelsDir = path.join(__dirname, 'models');
  for (const file of fs.readdirSync(modelsDir)) {
    if (file.endsWith('.js')) require(path.join(modelsDir, file));
  }
}

async function ensureCollections() {
  const names = Object.keys(mongoose.models);
  const existing = new Set(
    (await mongoose.connection.db.listCollections().toArray()).map(c => c.name)
  );
  for (const name of names) {
    const model = mongoose.models[name];
    if (!existing.has(model.collection.name)) {
      await model.createCollection();
      console.log(`📦 Created collection: ${model.collection.name}`);
    }
    await model.syncIndexes();
  }
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB:', MONGODB_URI);
    loadAllModels();
    await ensureCollections();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
