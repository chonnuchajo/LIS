import type { ItemGroupItem } from './api';

function norm(v: string | undefined | null): string {
  return String(v ?? '').trim().toUpperCase();
}

// itemNo ของ master item อาจมีช่องว่าง — เทียบแบบ trim ตรงตัว (ไม่ uppercase
// เพราะ itemNo เป็นรหัสที่ case มีความหมาย แต่ trim กันพลาด)
function normItemNo(v: string | undefined | null): string {
  return String(v ?? '').trim();
}

// item หนึ่งตัว → คืน group ID ที่สังกัด (เฉพาะ group ที่ status === 'active').
// กติกา: exclude ชนะทุกอย่าง > include > rule(commonName OR tradeName).
export function resolveItemGroups(
  args: { itemNo: string; commonName: string; tradeName: string },
  groups: ItemGroupItem[],
): string[] {
  const itemNo = normItemNo(args.itemNo);
  const cn = norm(args.commonName);
  const tn = norm(args.tradeName);
  const out: string[] = [];
  for (const grp of groups) {
    if (grp.status !== 'active') continue;
    const excluded = (grp.excludeItemNos ?? []).some((x) => normItemNo(x) === itemNo);
    if (itemNo && excluded) continue;
    const included = itemNo && (grp.includeItemNos ?? []).some((x) => normItemNo(x) === itemNo);
    const byCommon = cn && (grp.commonNames ?? []).some((c) => norm(c) === cn);
    const byTrade = tn && (grp.tradeNames ?? []).some((t) => norm(t) === tn);
    if (included || byCommon || byTrade) out.push(grp._id);
  }
  return out;
}

// สร้าง index จาก catalog ของ master items → Map<itemNo, groupId[]>.
// ใช้ทั้งฝั่งหน้า Master Item และฝั่ง testing เพื่อให้ membership ตรงกัน.
export function buildItemGroupIndex(
  items: Array<{ itemNo: string; commonName: string; tradeName: string }>,
  groups: ItemGroupItem[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const it of items) {
    const key = normItemNo(it.itemNo);
    if (!key) continue;
    map.set(key, resolveItemGroups(it, groups));
  }
  return map;
}
