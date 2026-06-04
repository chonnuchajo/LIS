const mongoose = require('mongoose');

// History of temperature/humidity readings that were explicitly saved
// (a new record is inserted only when the user clicks "save" — the live
// stream from Node-RED is kept in memory by the route, not persisted here).
const TempHumSchema = new mongoose.Schema({
  board: { type: String, required: true },
  hum: { type: Number },
  temp: { type: Number },
  receivedAt: { type: String }, // ISO time the reading was read by Node-RED
}, { timestamps: true }); // createdAt == time the user saved it

module.exports = mongoose.model('TempHum', TempHumSchema);
