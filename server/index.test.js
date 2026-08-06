const fs = require('fs');
const path = require('path');

// ทดสอบด้วยการอ่านไฟล์เป็นข้อความ ไม่ boot แอปจริง (ไม่ต่อ MongoDB) — ตรวจแค่ "ลำดับการวางโค้ด"
// ว่า apiGuard ถูก app.use() ไว้ก่อน mountApi(...) ทุกตัวเสมอ ถ้าใครแอบเพิ่ม mountApi(...) ไว้
// เหนือ apiGuard (เช่นตอน merge ชนกัน) endpoint นั้นจะหลุดพ้นการป้องกันไปเงียบๆ โดยไม่มี error ใดๆ
const SRC = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

describe('server/index.js — ลำดับ mount ของ apiGuard', () => {
  test('app.use(apiGuard) ต้องมาก่อนการเรียก mountApi(...) ตัวแรก', () => {
    const guardIndex = SRC.indexOf('app.use(apiGuard)');
    expect(guardIndex).toBeGreaterThan(-1);

    // ⚠️ ห้ามหา indexOf('mountApi(') เฉยๆ — จะไปเจอ `function mountApi(path, router) {` (ตัว
    // ประกาศฟังก์ชัน) ซึ่งอยู่เหนือ apiGuard เสมอโดยไม่ผิดอะไร ต้องมองหา "การเรียกใช้จริง"
    // (มี quote ตามหลังวงเล็บ) เท่านั้น
    const firstCallMatch = SRC.match(/mountApi\(\s*['"]/);
    expect(firstCallMatch).toBeTruthy();
    const firstCallIndex = firstCallMatch.index;

    expect(guardIndex).toBeLessThan(firstCallIndex);
  });
});
