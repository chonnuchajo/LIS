// Readers สำหรับ raw master item (จาก ERP/n8n webhook — โครงสร้าง key ไม่นิ่ง).
// key list ต้องสอดคล้องกับ MasterItems.tsx (codeKeys / commonNameKeys).
export const itemNoKeys = ['item_no', 'itemCode', 'item_code', 'code', 'Code', 'ITEM_CODE'];
export const sampleNameKeys = ['trade_name', 'tradename', 'tradeName', 'item_name1', 'itemName', 'item_name', 'name', 'Name', 'ITEM_NAME', 'description'];
export const commonNameKeys = ['common_name', 'commonname', 'commonName', 'item_name2', 'itemType'];
export const tradeNameKeys = ['trade_name', 'tradename', 'tradeName'];
export const packSizeKeys = ['packSize', 'pack_size', 'desc2', 'description2', 'item_name3'];

type RawItem = Record<string, unknown>;

export function firstValue(item: RawItem, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '';
}

export function getItemNo(item: RawItem): string {
  return firstValue(item, itemNoKeys).trim();
}

export function getSampleName(item: RawItem): string {
  return firstValue(item, sampleNameKeys).trim();
}

export function getRawCommonName(item: RawItem): string {
  return firstValue(item, commonNameKeys).trim();
}

export function getTradeName(item: RawItem): string {
  return firstValue(item, tradeNameKeys).trim();
}

export function getPackSize(item: RawItem): string {
  return firstValue(item, packSizeKeys).trim();
}
