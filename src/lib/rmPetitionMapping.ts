// แปลงแบชที่ RM ติ๊ก "ส่งตรวจ" ในฟอร์ม F-WAR-03-01 เป็น Petition.items[]
// 1 แบชที่ติ๊ก = 1 item — ผูกกลับหาฟอร์มด้วย batchNo
import type { GoodsReceiptReceipt } from '@/types/goodsReceipt.types';

// testItems ปล่อยว่างเสมอ (เหมือนที่ ItemsStep.tsx ของ production ส่ง) — RM ไม่มีช่องกรอกรายการทดสอบเอง
// แล้วปล่อยให้ matchParametersForItem (petitionTestItems.ts) จับคู่พารามิเตอร์ด้วย classification
// เหมือน production แทนที่จะ exact-match ชื่อพารามิเตอร์จากข้อความอิสระที่คนพิมพ์เอง
export interface RmTestSelection {
  batchNo: string;
  commonName: string;
  // ชื่อตัวอย่างจาก Master Item ที่เลือก — เก็บไว้แสดงผลใน trigger เท่านั้น ไม่ได้ใช้ประกอบ item
  sampleName?: string;
  // รหัส Master Item (RO-0123) — ขับ "หมวดหมู่ย่อย (prefix code)" + "กลุ่ม Item" ของ parameter
  itemNo?: string;
}

export interface RmPetitionItem {
  seq: number;
  sampleName: string;
  commonName: string;
  batchNo: string;
  testItems: string;
  itemNo: string;
}

export function buildRmPetitionItems(
  receipt: Pick<GoodsReceiptReceipt, 'productName' | 'productBatches'>,
  selections: RmTestSelection[],
): RmPetitionItem[] {
  const sampleName = String(receipt?.productName ?? '').trim();
  if (!sampleName) throw new Error('ต้องระบุชื่อสินค้า');

  const selected = (receipt?.productBatches ?? []).filter((b) => b?.sendToLab === true);
  if (selected.length === 0) throw new Error('ต้องเลือกแบชที่ส่งตรวจอย่างน้อย 1 แบช');
  if (selected.some((b) => !String(b.batchNo ?? '').trim())) {
    throw new Error('แบชที่ส่งตรวจต้องระบุแบชนัมเบอร์');
  }

  const byBatch = new Map(selections.map((s) => [String(s.batchNo ?? '').trim(), s]));

  return selected.map((batch, index) => {
    const batchNo = String(batch.batchNo).trim();
    const pick = byBatch.get(batchNo);
    // แบชที่ไม่มี selection เลย (หรือยังไม่ได้เลือก Master Item) ควรฟ้อง
    // "ยังไม่ได้เลือกรายการสินค้าอ้างอิง" เพราะนั่นคือขั้นเดียวที่ค้างในสเต็ปนี้ —
    // commonName เป็นตัวขับการจับคู่พารามิเตอร์ (classification-based เหมือน production) และ
    // simple-method ตอน assign เครื่องมือด้วย — ขาดไม่ได้
    const commonName = String(pick?.commonName ?? '').trim();
    if (!commonName) {
      throw new Error(`ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช ${batchNo}`);
    }
    return {
      seq: index + 1,
      sampleName,
      commonName,
      batchNo,
      itemNo: String(pick?.itemNo ?? '').trim(),
      // ปล่อยว่างเสมอ — ดู comment บน RmTestSelection ด้านบน
      testItems: '',
    };
  });
}
