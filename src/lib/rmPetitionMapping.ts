// แปลงแบชที่ RM ติ๊ก "ส่งตรวจ" ในฟอร์ม F-WAR-03-01 เป็น Petition.items[]
// 1 แบชที่ติ๊ก = 1 item — ผูกกลับหาฟอร์มด้วย batchNo
import type { GoodsReceiptReceipt } from '@/types/goodsReceipt.types';

// testItems เป็น string เดียว (ไม่ใช่ array) ให้ตรงกับ Petition.items[].testItems ทั้ง stack
export interface RmTestSelection {
  batchNo: string;
  commonName: string;
  testItems: string;
}

export interface RmPetitionItem {
  seq: number;
  sampleName: string;
  commonName: string;
  batchNo: string;
  testItems: string;
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
    // เช็ค commonName ก่อน testItems: ใน wizard ผู้ใช้เลือก Master Item ก่อนแล้วค่อยกรอกรายการทดสอบ
    // ดังนั้นแบชที่ไม่มี selection เลย (หรือยังไม่ได้เลือก Master Item) ควรฟ้อง
    // "ยังไม่ได้เลือกรายการสินค้าอ้างอิง" เพราะนั่นคือขั้นแรกที่ค้างจริง ๆ — ช่อง testItems
    // ยังไม่มีความหมายจนกว่าจะเลือก Master Item แล้ว commonName เป็นตัวขับการจับคู่
    // simple-method ตอน assign เครื่องมือด้วย — ขาดไม่ได้
    const commonName = String(pick?.commonName ?? '').trim();
    if (!commonName) {
      throw new Error(`ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช ${batchNo}`);
    }
    const testItems = String(pick?.testItems ?? '').trim();
    if (!testItems) {
      throw new Error(`ยังไม่ได้เลือกรายการทดสอบของแบช ${batchNo}`);
    }
    return {
      seq: index + 1,
      sampleName,
      commonName,
      batchNo,
      testItems,
    };
  });
}
