// ผู้ใช้คนหนึ่ง "อยู่ฝั่งไหน" ในสายตาของระบบแจ้งเตือน — คีย์ตรงกับ LineGroup.audience
// ฝั่ง server (qc / lab / production / rm / fg) เพื่อให้ endpoint กรองด้วยชุดคำเดียวกัน
import { normalizeRoles } from "@/lib/roles";

export interface AudienceUser {
  role?: string;
  roles?: string[];
  department?: string;
}

const ROLE_AUDIENCE: Record<string, string> = {
  "qc-head": "qc",
  "qc-staff": "qc",
  "lab-head": "lab",
  "lab-analyze": "lab",
};

// department มาจาก HR/Microsoft จึงสะกดได้หลายแบบ — match แบบหลวมทั้งไทยและอังกฤษ
const DEPT_PATTERNS: Array<[RegExp, string]> = [
  [/\brm\b|วัตถุดิบ/i, "rm"],
  [/\bfg\b|สำเร็จรูป/i, "fg"],
  [/production|ผลิต/i, "production"],
  [/\bqc\b|ควบคุมคุณภาพ/i, "qc"],
  [/\blab\b|วิเคราะห์/i, "lab"],
];

/** audience ทั้งหมดของผู้ใช้ (role ∪ department) — `admin` ไม่ได้สิทธิ์พิเศษตรงนี้ */
export function audiencesForUser(user: AudienceUser | null | undefined): string[] {
  if (!user) return [];
  const out: string[] = [];
  const add = (a: string) => { if (a && !out.includes(a)) out.push(a); };

  for (const role of normalizeRoles(user)) {
    const audience = ROLE_AUDIENCE[role];
    if (audience) add(audience);
  }
  const dept = user.department || "";
  for (const [pattern, audience] of DEPT_PATTERNS) {
    if (pattern.test(dept)) add(audience);
  }
  return out;
}

const SEE_ALL_KEY = "lis.petitionNotify.seeAll";
/** bell เปลี่ยนสวิตช์ → watcher ต้อง refetch ทันที (คนละ subtree จึงคุยกันผ่าน window event) */
export const SEE_ALL_EVENT = "lis:petition-notify-seeall";

export function readSeeAll(): boolean {
  try {
    return localStorage.getItem(SEE_ALL_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSeeAll(value: boolean): void {
  try {
    if (value) localStorage.setItem(SEE_ALL_KEY, "1");
    else localStorage.removeItem(SEE_ALL_KEY);
  } catch {
    // private mode / quota — สวิตช์แค่ไม่จำข้ามรีเฟรช ไม่ต้องพัง
  }
  window.dispatchEvent(new Event(SEE_ALL_EVENT));
}
