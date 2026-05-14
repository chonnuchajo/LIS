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
mountApi('/employees', require('./routes/employees'));
mountApi('/master-items', require('./routes/masterItems'));
mountApi('/machines', require('./routes/machines'));

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

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB:', MONGODB_URI);
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
