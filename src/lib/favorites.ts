// รายการโปรดบน sidebar — pure helper ล้วน ไม่มี React/network
// mirror ของ server/lib/favorites.js — MAX_FAVORITES ต้องตรงกันสองฝั่ง

export const MAX_FAVORITES = 20;

export type FavoriteMoveDirection = "up" | "down";

/** มีอยู่แล้ว → เอาออก, ยังไม่มี → ต่อท้าย (ตัวใหม่สุดอยู่ล่างสุด) */
export function toggleFavorite(paths: string[], path: string): string[] {
  return paths.includes(path) ? paths.filter((p) => p !== path) : [...paths, path];
}

/**
 * สลับตำแหน่งกับเพื่อนบ้าน คืน array ตัวเดิม (identity เดิม) เมื่อขยับไม่ได้
 * ผู้เรียกใช้เช็คด้วย `next !== paths` เพื่อข้ามการยิง API ที่ไม่จำเป็นได้
 */
export function moveFavorite(
  paths: string[],
  path: string,
  direction: FavoriteMoveDirection,
): string[] {
  const index = paths.indexOf(path);
  if (index < 0) return paths;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= paths.length) return paths;
  const next = [...paths];
  next[index] = paths[target];
  next[target] = paths[index];
  return next;
}

/** ตัดตัวซ้ำ + ทิ้ง path ที่ไม่มีใน nav catalog แล้ว + cap ที่ MAX_FAVORITES */
export function normalizeFavorites(
  paths: string[] | undefined,
  knownPaths: string[],
): string[] {
  const known = new Set(knownPaths);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of paths ?? []) {
    if (!known.has(path) || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}
