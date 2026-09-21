export const protocolFields = [
  ["purpose", "1. วัตถุประสงค์", "ระบุสิ่งที่ต้องการพิสูจน์จากการตรวจสอบวิธี"],
  ["scope", "2. ขอบเขตและเมทริกซ์", "สาร ผลิตภัณฑ์/เมทริกซ์ ช่วงความเข้มข้น และข้อจำกัดการใช้วิธี"],
  ["references", "3. เอกสารอ้างอิง", "ชื่อเอกสาร เลขที่ ฉบับ/ปี และหัวข้อที่ใช้กำหนดเกณฑ์"],
  ["instruments", "4.1 เครื่องมือและอุปกรณ์", "รุ่น รหัสเครื่อง/Serial No. และสถานะสอบเทียบที่เกี่ยวข้อง"],
  ["materials", "4.2 วัสดุสิ้นเปลือง", "Column, vial, filter หรือวัสดุที่มีผลต่อการวิเคราะห์"],
  ["reagents", "4.3 สารเคมีและสารมาตรฐาน", "ชื่อสาร เกรด CAS, Lot, Purity, Certificate และวันหมดอายุ"],
  ["principle", "5.1 หลักการวิเคราะห์", "เทคนิค การตรวจวัด และวิธีหาปริมาณ เช่น external standard"],
  ["conditions", "5.2 สภาวะการวิเคราะห์", "Column, temperature program, flow, detector, injection volume และสภาวะที่ใช้จริง"],
  ["systemSuitability", "5.3 ความเหมาะสมของระบบ", "วิธีเตรียม ลำดับฉีด และหลักฐาน SST; เกณฑ์ตัวเลขตั้งในแท็บที่เกี่ยวข้อง"],
  ["solvent", "6.1 การเตรียม Solvent", "ชนิด อัตราส่วน เกรด และวิธีเตรียม diluent"],
  ["matrixBlank", "6.3 การเตรียม Matrix Blank", "องค์ประกอบ สัดส่วน วิธีเตรียม และหลักฐานว่าไม่มีสารเป้าหมาย"],
  ["preparationNotes", "6.4–6.5 ขั้นตอนการเตรียมแต่ละระดับ", "รายละเอียดเพิ่มเติมจากตาราง เช่น การละลาย การผสม การเก็บรักษา และอายุสารละลาย"],
  ["intermediateDesign", "6.6 แผนการทดสอบต่างวัน", "วันที่ ผู้วิเคราะห์ เครื่องมือ และตัวแปรที่เปลี่ยน; กำหนดจำนวนซ้ำใน Precision"],
  ["sampleProcedure", "6.7 การเตรียมตัวอย่างและ QC", "วิธีสุ่ม/ชั่งตัวอย่าง การสกัด การเจือจาง และการเตรียม Standard Check/Matrix Spike"],
  ["sequence", "7. แผนและลำดับการทดสอบ", "ระบุลำดับ Blank, Standard, Sample และ QC พร้อมรหัสชุดวิเคราะห์"],
  ["deviations", "9. ข้อเบี่ยงเบนและข้อจำกัด", "เหตุการณ์ การแก้ไข และผลกระทบ; ระบุว่าไม่มีเมื่อได้ตรวจแล้ว"],
  ["conclusion", "10. บทสรุปของผู้ทบทวน", "สรุปความเหมาะสม ช่วงที่ยอมรับ และข้อจำกัด โดยอ้างอิงผลจริง"],
] as const;
export type ProtocolDetails = Record<typeof protocolFields[number][0], string>;
export const defaultProtocolDetails = (): ProtocolDetails => Object.fromEntries(protocolFields.map(([key]) => [key, ""])) as ProtocolDetails;
export const hasProtocolDetails = (details: ProtocolDetails) => protocolFields.some(([key]) => details[key].trim());
export function evaluateProtocolDetails(details: ProtocolDetails) {
  const required = ["purpose", "scope", "references", "instruments", "reagents", "principle", "conditions", "matrixBlank", "sequence", "conclusion"];
  const missing = protocolFields.filter(([key]) => required.includes(key) && !details[key].trim()).map(([, label]) => label);
  return { missing, check: { name: "ความครบถ้วนของรายละเอียดวิธีและบทสรุป", value: missing.length ? `ยังไม่ระบุ ${missing.length} หัวข้อ` : "กรอกหัวข้อหลักครบ", criteria: "วัตถุประสงค์ ขอบเขต แหล่งอ้างอิง เครื่องมือ สารเคมี หลักการ สภาวะ Matrix Blank แผนทดสอบ และบทสรุป", pass: missing.length ? null : true as boolean | null } };
}
