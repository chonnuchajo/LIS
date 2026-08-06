// Type + คำแปลของแท็บ "API Key" ในหน้า /settings
// ทะเบียน scope/endpoint ตัวจริงอยู่ที่ server/lib/apiPolicy.js และส่งมาทาง
// GET /api-keys/meta — ห้าม hardcode ซ้ำที่นี่ (บทเรียนจาก lineConfig.ts)

export type ApiKeyStatus = "active" | "expired" | "revoked";
export type ApiPolicyMode = "off" | "audit" | "enforce";

export type ApiScope = { id: string; label: string };

export type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  usageCount: number;
  createdBy: string;
  createdAt: string | null;
  status: ApiKeyStatus;
};

/** ตอบกลับเฉพาะตอนสร้าง — ค่า key เต็มไม่มีที่ไหนเก็บอีก */
export type CreatedApiKey = ApiKeyItem & { rawKey: string };

export type ApiKeyInput = {
  name: string;
  scopes: string[];
  expiresAt: string | null;
  rateLimitPerMinute: number;
};

export type ApiPolicyItem = {
  id: string;
  label: string;
  methods: string[];
  path: string;
  scope: string;
  mode: ApiPolicyMode;
  legacyEnv: string | null;
  wouldBlock7d: number;
};

export type ApiKeyMeta = {
  scopes: ApiScope[];
  modes: ApiPolicyMode[];
  policies: ApiPolicyItem[];
};

export type ApiRequestLogItem = {
  id: string;
  at: string;
  keyName: string;
  method: string;
  path: string;
  policyId: string;
  mode: ApiPolicyMode;
  outcome: string;
  reason: string;
  ip: string;
  status: number;
};

export const API_KEY_STATUS_LABEL: Record<ApiKeyStatus, string> = {
  active: "ใช้งาน",
  expired: "หมดอายุ",
  revoked: "เพิกถอนแล้ว",
};

export const API_POLICY_MODE_LABEL: Record<ApiPolicyMode, string> = {
  off: "ปิด (ไม่ตรวจ)",
  audit: "เฝ้าดู (ไม่บล็อก)",
  enforce: "บังคับใช้ key",
};

export const API_OUTCOME_LABEL: Record<string, string> = {
  allowed: "ผ่าน",
  "legacy-token": "ผ่าน (token เดิม)",
  "audit-pass": "ผ่าน (โหมดเฝ้าดู)",
  denied: "ปฏิเสธ",
  "rate-limited": "เกินโควตา",
};

export const API_REASON_LABEL: Record<string, string> = {
  ok: "—",
  "legacy-token": "ใช้ token เดิมใน .env",
  "no-key": "ไม่ได้ส่ง key มา",
  "unknown-key": "key ไม่รู้จัก",
  revoked: "key ถูกเพิกถอน",
  expired: "key หมดอายุ",
  "missing-scope": "scope ไม่ครอบ endpoint นี้",
  "rate-limited": "ยิงเกินโควตาต่อนาที",
};

export const EXPIRING_SOON_DAYS = 7;

/** ใกล้หมดอายุใน 7 วัน (ที่หมดไปแล้วนับเป็นสถานะ expired ไม่ใช่ "ใกล้หมด") */
export function isExpiringSoon(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return false;
  return ms > 0 && ms <= EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
}
