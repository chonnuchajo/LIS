const fs = require("fs");

const substances = JSON.parse(
  fs.readFileSync("./.data/product-density-ranges.json", "utf8")
);

const substanceStandards = substances
  .filter(
    (item) =>
      item.sgMin !== null &&
      item.sgMax !== null
  )
  .map((item) => ({
    substance: item.commonName,
    operator: "between",
    value: Number(item.sgMin),
    value2: Number(item.sgMax),
    headOnly: false
  }));

const valueField = {
  label: "ค่าถพ.",
  type: "float",
  unit: "g/cm3",
  min: null,
  max: null,
  options: [],
  requireNoteOn: [],
  expectedValues: [],
  standardValue: null,
  standardOperator: null,
  standardValue2: null,
  timerDurationSec: null,
  timerUnit: null,
  required: true,
  multiple: false,
  maxPhotos: 5,
  maxFiles: 5,
  allowedFileTypes: [],
  phase: "both",
  triggersPhase2: false,
  refParameterId: null,
  refFieldLabel: null,
  refPhase: 1,
  substanceMode: true,
  substanceStandards
};

fs.writeFileSync(
  "./value-field.json",
  JSON.stringify(valueField, null, 2),
  "utf8"
);