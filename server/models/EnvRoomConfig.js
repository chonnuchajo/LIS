const mongoose = require('mongoose');

const EnvRoomConfigSchema = new mongoose.Schema({
  slug: {
    type: String,
    enum: ['balance', 'sample-prep', 'analysis'],
    required: true,
    unique: true,
    index: true,
  },
  boardId: { type: String, default: '' },   // '' = no sensor / manual entry
  tempMin: { type: Number, required: true },
  tempMax: { type: Number, required: true },
  humidityMax: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('EnvRoomConfig', EnvRoomConfigSchema);
