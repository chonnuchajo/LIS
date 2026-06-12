const mongoose = require('mongoose');

const ResultDensitySchema = new mongoose.Schema({}, {
  collection: 'Result-Density',
  strict: false,
  timestamps: false,
});

module.exports = mongoose.model('ResultDensity', ResultDensitySchema);
