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

// API Routes
app.use('/api/samples', require('./routes/samples'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/physical-results', require('./routes/physicalResults'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/densities', require('./routes/densities'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/access-control', require('./routes/accessControl'));
app.use('/api/petitions', require('./routes/petitions'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/master-items', require('./routes/masterItems'));
app.use('/LIS/api/master-items', require('./routes/masterItems'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

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
