import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { defaultPrecisionSettings, defaultQcSettings, evaluatePrecision, evaluateQc } from "./validationAdvanced";
import { defaultPreparationLevels, defaultLinearitySettings, checkLinearityPreparation } from "./validationPreparation";
import { defaultProtocolDetails, protocolFields } from "./validationProtocol";
import { defaultSpecificitySettings, evaluateSpecificity, specificitySnapshot } from "./validationSpecificity";
import { parseMeasurements, regression, stats } from "./validationCalculator";
import { readValidationProject } from "./validationProject";
import { createValidationReport } from "./validationReport";

// Accuracy measurements transcribed from source report page 17 (µg/mL).
// Every other measurement below is synthetic QA data, not laboratory evidence.
const sourceFound = [
  [102.1,98.8,99.1,101.7,95.8,101.3,100.8,100.1,101.2,101.3],
  [495.1,499.2,501.3,500.3,494.7,495.7,501.5,503.9,495.9,496.7],
  [1002.3,1008.2,1001.8,1002.9,999.9,1006.1,1007.3,1001.5,997.5,1006.6],
];
it("ตรวจรายงานครบชุดจากข้อมูลต้นฉบับและข้อมูล QA ที่ระบุชัด", () => {
  const targets = [0.1,0.5,1];
  const protocolDetails = defaultProtocolDetails();
  for (const [key,label] of protocolFields) protocolDetails[key] = `${label}: ข้อมูลจำลองสำหรับ QA เท่านั้น ไม่ใช่หลักฐานรับรองวิธี`;
  const texts = [Array(6).fill("4.4,125").join("\n"), [0.1,0.25,0.5,0.75,1].flatMap(x => [-0.01,0,0.01].map(delta => `${x},${250*x+delta}`)).join("\n"), targets.flatMap((target,i)=>sourceFound[i].map(found=>`${target},${target},${found/1000}`)).join("\n")];
  const project = readValidationProject(JSON.stringify({
    format: "lis-validation-project", version: 1, title: "QA ONLY · รายงานครบชุด", analyte: "QA analyte", method: "GC-FID",
    prep: ["50","100","25","250","1000"], texts, blank: "", preparationLevels: defaultPreparationLevels(), protocolDetails,
    reportMeta: { analyst: "QA", reviewer: "QA reviewer", protocol: "QA protocol — ไม่ใช่ SOP จริง", calibration: "QA-CAL", notes: "Accuracy ใช้ข้อมูลที่พิมพ์ในหน้า 17 ของรายงานต้นฉบับ ที่เหลือเป็นข้อมูลจำลองสำหรับทดสอบระบบเท่านั้น" },
    precision: { ...defaultPrecisionSettings(), massFractions: "0.1,0.1\n0.5,0.1\n1,0.1", dailyData: Array.from({length:6},(_,day)=>targets.flatMap(target=>Array.from({length:10},(_,rep)=>`${day+1},${target},${target},${target*(1+(day-2.5)*0.0005+(rep-4.5)*0.0001)}`))).flat().join("\n") },
    qc: { ...defaultQcSettings(), enabled: true, productLow: "23.5", productHigh: "26.5", sampleData: "50.58,0.5034,25,1,1.05", standardData: "0.505,0.5028975\n0.503,0.5028975", spikeData: "0.505,0.302,0.201159\n0.503,0.302,0.201159" },
    specificity: { ...defaultSpecificitySettings(), blankData: "0,0\n0,0\n0,0", standardReference: "QA-STD", solventReference: "QA-SOL", matrixReference: "QA-MATRIX", reviewNotes: "ข้อมูลจำลอง", decision: "passed", reviewedAt: "2026-09-17T00:00:00Z" },
  }));
  const context = { standardData: texts[0], analyte: project.analyte, method: project.method, protocol: project.reportMeta.protocol, calibration: project.reportMeta.calibration, reviewer: project.reportMeta.reviewer, preparation: JSON.stringify({prep:project.prep,preparationLevels:project.preparationLevels,protocolDetails}) };
  project.specificity.reviewedSnapshot = specificitySnapshot(project.specificity, context);
  const specificity = evaluateSpecificity(project.specificity, context);
  const precision = evaluatePrecision(project.precision, targets, texts[2]);
  const qc = evaluateQc(project.qc);
  const linearRows = parseMeasurements(texts[1],2).rows;
  expect(checkLinearityPreparation(linearRows,project.preparationLevels,2,[],defaultLinearitySettings()).ready).toBe(true);
  expect(regression(linearRows)?.slope).toBeCloseTo(250,8);
  expect(specificity.checks.every(check=>check.pass===true)).toBe(true);
  expect(precision.checks.every(check=>check.pass===true)).toBe(true);
  expect(qc.checks.every(check=>check.pass===true)).toBe(true);
  expect(precision.rawDaily).toHaveLength(180);
  expect(stats(sourceFound[0])?.mean).toBeCloseTo(100.22,8);
  expect(stats(sourceFound[1])?.sd).toBeCloseTo(3.22354,5);
  expect(stats(sourceFound[2])?.mean).toBeCloseTo(1003.41,8);
  const html = createValidationReport({ title:project.title,analyte:project.analyte,method:project.method,...project.reportMeta,prep:project.prep,levels:project.preparationLevels,texts,blank:"",checks:[...specificity.checks,...precision.checks,...qc.checks],errors:[],precision,qc,includeQc:true,specificity:project.specificity,protocolDetails, logoDataUrl: `data:image/png;base64,${readFileSync(join(process.cwd(), "src/assets/icp-ladda-logo.png")).toString("base64")}` });
  expect(html).toContain("<td>0.10022</td>");
  expect(html).toContain("<td>0.49843</td>");
  expect(html).toContain("<td>1.00341</td>");
  expect(html).toContain("Mean Found mg/mL");
  expect(html).toContain("<td>102.10</td><td>100.00</td><td>102.10</td>");
  expect(html).toContain("data:image/png;base64,");
  expect(html).not.toContain("Cypermethrin");
  expect(html).toContain("8.4 Precision");
  expect(html).toContain("Factor ของ Repeatability = 1");
  expect(html).not.toMatch(/NaN|Infinity/);
  expect(readValidationProject(JSON.stringify(project))).toEqual(project);
  if (process.env.VALIDATION_QA_ARTIFACTS === "1") {
    writeFileSync(join(tmpdir(),"lis-validation-full-qa.json"),JSON.stringify(project,null,2));
    writeFileSync(join(tmpdir(),"lis-validation-full-qa.html"),html);
  }
});
