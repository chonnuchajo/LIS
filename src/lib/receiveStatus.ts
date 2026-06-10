import type { Petition } from '@/types/petition.types';

/**
 * Per-side receive status (Lab / QC), with legacy backward-compat.
 *
 * ใบที่รับก่อนมีฟีเจอร์แยก Lab/QC มีแต่ field รวม `receivedBy`/`receivedAt`
 * (ไม่มี `labReceivedAt`/`qcReceivedAt`). ถือว่าเป็น "legacy received" แล้วให้
 * `receivedBy`/`receivedAt` นับเป็นของฝั่งที่ถาม (ทั้ง Lab และ QC) — ใบเก่าจึง
 * โชว์ว่ารับแล้ว + ชื่อผู้รับได้
 *
 * ใบใหม่ที่มี side field อย่างน้อยหนึ่งฝั่งแล้ว จะ "ไม่" fallback — กันไม่ให้
 * ใบ mixed (เช่น Lab รับก่อน) แสดงผู้รับฝั่ง Lab เป็นผู้รับฝั่ง QC ผิดๆ
 */
export function isLegacyReceived(p: Pick<Petition, 'labReceivedAt' | 'qcReceivedAt' | 'receivedAt'>): boolean {
  return !p.labReceivedAt && !p.qcReceivedAt && !!p.receivedAt;
}

type ReceiveFields = Pick<
  Petition,
  'labReceivedAt' | 'labReceivedBy' | 'qcReceivedAt' | 'qcReceivedBy' | 'receivedAt' | 'receivedBy'
>;

export function labReceivedAt(p: ReceiveFields): string | null | undefined {
  return p.labReceivedAt ?? (isLegacyReceived(p) ? p.receivedAt : null);
}

export function labReceivedBy(p: ReceiveFields): string | undefined {
  return p.labReceivedBy ?? (isLegacyReceived(p) ? p.receivedBy : undefined);
}

export function qcReceivedAt(p: ReceiveFields): string | null | undefined {
  return p.qcReceivedAt ?? (isLegacyReceived(p) ? p.receivedAt : null);
}

export function qcReceivedBy(p: ReceiveFields): string | undefined {
  return p.qcReceivedBy ?? (isLegacyReceived(p) ? p.receivedBy : undefined);
}
