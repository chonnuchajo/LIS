const express = require('express');
const Machine = require('../models/Machine');
const VirtualLabRoom = require('../models/VirtualLabRoom');
const VirtualLabLog = require('../models/VirtualLabLog');

const router = express.Router();
const STATUSES = new Set(['idle', 'running', 'error', 'maintenance', 'offline']);

const populateRoom = (query) => query.populate('instruments.machine').lean();

router.get('/rooms', async (_req, res) => {
  try {
    const rooms = await populateRoom(VirtualLabRoom.find().sort({ createdAt: 1 }));
    res.json({ data: rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const room = await VirtualLabRoom.create({ name });
    res.status(201).json({ data: await populateRoom(VirtualLabRoom.findById(room._id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/rooms/:roomId/instruments', async (req, res) => {
  try {
    const { machineId } = req.body;
    const room = await VirtualLabRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'room not found' });
    const machine = await Machine.findById(machineId);
    if (!machine) return res.status(404).json({ error: 'machine not found' });

    const exists = room.instruments.some((i) => String(i.machine) === String(machine._id));
    if (!exists) {
      room.instruments.push({
        machine: machine._id,
        x: (room.instruments.length % 4) + 1,
        y: Math.floor(room.instruments.length / 4) + 1,
      });
      await room.save();
    }

    res.status(201).json({ data: await populateRoom(VirtualLabRoom.findById(room._id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/rooms/:roomId/instruments/:instrumentId', async (req, res) => {
  try {
    const room = await VirtualLabRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'room not found' });
    const item = room.instruments.id(req.params.instrumentId);
    if (!item) return res.status(404).json({ error: 'instrument not found' });

    const oldStatus = item.status;
    if (req.body.status !== undefined) {
      if (!STATUSES.has(req.body.status)) return res.status(400).json({ error: 'invalid status' });
      item.status = req.body.status;
    }
    if (req.body.x !== undefined) item.x = Math.max(1, Number(req.body.x) || 1);
    if (req.body.y !== undefined) item.y = Math.max(1, Number(req.body.y) || 1);
    if (req.body.note !== undefined) item.note = String(req.body.note || '');
    item.updatedBy = String(req.body.actor || 'system');
    item.updatedAt = new Date();
    await room.save();

    if (oldStatus !== item.status) {
      await VirtualLabLog.create({
        room: room._id,
        virtualInstrumentId: item._id,
        machine: item.machine,
        oldStatus,
        newStatus: item.status,
        note: item.note,
        actor: item.updatedBy,
      });
    }

    res.json({ data: await populateRoom(VirtualLabRoom.findById(room._id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/rooms/:roomId/instruments/:instrumentId', async (req, res) => {
  try {
    const room = await VirtualLabRoom.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'room not found' });
    const item = room.instruments.id(req.params.instrumentId);
    if (!item) return res.status(404).json({ error: 'instrument not found' });
    item.deleteOne();
    await room.save();
    res.json({ data: await populateRoom(VirtualLabRoom.findById(room._id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/rooms/:roomId/logs', async (req, res) => {
  try {
    const logs = await VirtualLabLog.find({ room: req.params.roomId })
      .populate('machine')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json({ data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
