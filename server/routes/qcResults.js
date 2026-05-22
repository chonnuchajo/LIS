const express = require("express");
const router = express.Router();
const QCTestResult = require("../models/QCTestResult");

// GET /api/qc-results/:petitionId
router.get("/:petitionId", async (req, res) => {
  try {
    const results = await QCTestResult.find({ petitionId: req.params.petitionId }).lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/qc-results — upsert a single field value
router.put("/", async (req, res) => {
  try {
    const {
      petitionId, petitionNo,
      itemSeq, sampleId, sampleName,
      parameterId, parameterName,
      fieldLabel, value,
      enteredBy,
    } = req.body;

    if (!petitionId || itemSeq == null || !parameterId || !fieldLabel) {
      return res.status(400).json({ error: "petitionId, itemSeq, parameterId, fieldLabel are required" });
    }

    const filter = { petitionId, itemSeq, parameterId };
    const now = new Date();

    // Check if document already exists to decide whether to set enteredBy/enteredAt
    const existing = await QCTestResult.findOne(filter);
    const isNew = !existing;

    const update = {
      $set: {
        petitionNo, sampleId, sampleName, parameterName,
        [`values.${fieldLabel}`]: value,
        updatedBy: enteredBy,
        updatedAt: now,
      },
    };

    if (isNew || !existing.enteredBy) {
      update.$set.enteredBy = enteredBy;
      update.$set.enteredAt = now;
    }

    const doc = await QCTestResult.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
