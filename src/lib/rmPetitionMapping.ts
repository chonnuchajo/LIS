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
    // เช็ค testItems ก่อน commonName: แบชที่ไม่มี selection เลยถือว่า "ยังไม่ได้เลือกรายการทดสอบ"
    // (ไม่ใช่ "ยังไม่ได้เลือกรายการสินค้าอ้างอิง") ส่วนแบชที่มี selection แต่ commonName ว่างเปล่า
    // ให้ฟ้อง error รายการสินค้าอ้างอิงแทน
    const testItems = String(pick?.testItems ?? '').trim();
    if (!testItems) {
      throw new Error(`ยังไม่ได้เลือกรายการทดสอบของแบช ${batchNo}`);
    }
    // commonName เป็นตัวขับการจับคู่ simple-method ตอน assign เครื่องมือ — ขาดไม่ได้
    const commonName = String(pick?.commonName ?? '').trim();
    if (!commonName) {
      throw new Error(`ยังไม่ได้เลือกรายการสินค้าอ้างอิงของแบช ${batchNo}`);
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
