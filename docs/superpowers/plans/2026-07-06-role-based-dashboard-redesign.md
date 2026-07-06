# Role-based Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แทนแดชบอร์ด/หน้าแรกที่กระจัดกระจาย (Home* 5 ตัว + LabDashboard/QCDashboard) ด้วย `RoleDashboard` ตัวเดียวที่ render ตาม **DashboardProfile** (9 profile) ซึ่ง resolve จาก active role ของผู้ใช้ พร้อม active-role switcher — แสดงเฉพาะ KPI/chart ที่มีข้อมูลจริง

**Architecture:** config-driven profile registry (Approach 1). Profile 9 ตัวเป็น data ในโค้ด (`src/lib/dashboardProfiles.ts`) ผูกกับ role ผ่าน field `Role.dashboardProfile` (decoupled, มี default map). Logic คำนวณ KPI/chart เป็น **pure functions** (`src/lib/dashboardMetrics.ts`) ทดสอบด้วย fixture. UI ประกอบจาก building blocks กลาง (`src/components/dashboard/*`) reuse `StatCard`, `ui/chart` (recharts), Badge เดิม.

**Tech Stack:** React 18 + TS + Vite + Tailwind + shadcn/ui + TanStack Query + recharts ^2.15 + Vitest/jsdom/@testing-library/react (frontend) · Express + Mongoose + `node:test` (server).

## Global Constraints

- **ภาษา/สไตล์:** label หลักเป็นไทย, ใช้อังกฤษเฉพาะชื่อ role เชิงเทคนิค (title แดชบอร์ด). คงสไตล์เดิม: ขาว/เทาอ่อน, primary น้ำเงิน, การ์ดมุมมน, เส้นขอบบาง, compact. semantic color: **น้ำเงิน=กำลังทำ · เหลือง=รอ · แดง=เกิน/ผิดปกติ · เขียว=เสร็จ**
- **ข้อมูลจริงเท่านั้น:** ห้าม mock/placeholder หลอกตา. KPI/chart ที่ไม่มีแหล่งข้อมูลจริง → ไม่ทำ. delta ▲▼ แสดงเฉพาะตัวที่คำนวณค่า prior ได้จริง (today vs yesterday) เท่านั้น
- **ไม่เพิ่ม backend aggregate:** petition ดึง client-side (ขยาย limit เป็น 200 สำหรับแดชบอร์ด). total/trend = "ในช่วงข้อมูลที่ดึง" — ใส่ comment caveat ในโค้ด
- **type-check จริง:** `npx tsc -p tsconfig.app.json --noEmit` (root `tsc --noEmit` เป็น no-op). lint: `npm run lint`
- **test:** frontend `npx vitest run <path>` · server `node --test server/lib/<file>.test.js`
- **git:** commit เฉพาะไฟล์ตัวเองด้วย explicit pathspec (มี committer อื่นในรีโป). ห้าม `npm run build`
- **นอกขอบเขต (spec B / follow-up):** หน้า User/Role management, การสร้าง+assign 9 role จริง, metric เชิงเวลา (trend/turnaround/SLA/pass-rate over time), backend aggregate

---

## File Structure

**สร้างใหม่:**
- `src/lib/dashboardProfiles.ts` — types + 9-profile registry + KPI_META + `resolveProfileForRole` + `resolveActiveRole`
- `src/lib/dashboardProfiles.test.ts`
- `src/lib/dashboardMetrics.ts` — pure compute (KPI values, chart datasets)
- `src/lib/dashboardMetrics.test.ts`
- `src/lib/dateShift.ts` — pure Thai-date / shift / greeting helpers (แยกจาก HomeHeader)
- `src/lib/dateShift.test.ts`
- `src/store/activeRole.ts` — module store (localStorage) + `useActiveRole` hook
- `src/store/activeRole.test.ts`
- `src/hooks/useDashboardData.ts` — orchestrator hook
- `src/components/dashboard/DashboardHeader.tsx`
- `src/components/dashboard/ActiveRoleSwitcher.tsx`
- `src/components/dashboard/KpiRow.tsx`
- `src/components/dashboard/ActionTable.tsx`
- `src/components/dashboard/WorkflowSummary.tsx` (StatusDonut + PipelineBar ในไฟล์เดียว)
- `src/components/dashboard/AnalyticsSection.tsx` (BarPanel + DonutPanel)
- `src/components/dashboard/ActivityTimeline.tsx`
- `src/components/dashboard/DashboardHeader.test.tsx` (smoke)
- `src/pages/RoleDashboard.tsx`
- `server/lib/dashboardProfiles.js` — id list + validator (mirror ของ client)
- `server/lib/dashboardProfiles.test.js`

**แก้:**
- `src/pages/Home.tsx` — render `<RoleDashboard/>`
- `src/App.tsx` — redirect `/dashboard/lab`,`/dashboard/qc` → `/home`
- `src/components/lis/AppSidebar.tsx` — scope nav ตาม active role + `"/"` → `/home`
- `src/components/home/HomeHeader.tsx` — reuse `dateShift.ts` (DRY)
- `src/components/lis/DashboardLayoutConfigCard.tsx` — เพิ่ม dropdown role→profile
- `server/models/Role.js` — field `dashboardProfile`
- `server/routes/accessControl.js` — `formatRole` + `PATCH /roles/:id`

**ลบ (Task สุดท้าย):**
- `src/components/home/HomeAdmin.tsx`, `HomeLab.tsx`, `HomeQC.tsx`, `HomeViewer.tsx`, `HomeGeneric.tsx`
- `src/pages/LabDashboard.tsx`, `src/pages/QCDashboard.tsx`

---

## Task 1: Server — `dashboardProfile` field + validator + route

**Files:**
- Create: `server/lib/dashboardProfiles.js`
- Test: `server/lib/dashboardProfiles.test.js`
- Modify: `server/models/Role.js:4-10`, `server/routes/accessControl.js:171-178` (formatRole) + add PATCH route near `:464`

**Interfaces:**
- Produces: `DASHBOARD_PROFILE_IDS: string[]`, `isValidProfileId(id): boolean` (server, CommonJS). `formatRole()` output gains `dashboardProfile: string | null`. New route `PATCH /roles/:id` reads `{ name?, description?, dashboardProfile? }`.

- [ ] **Step 1: Write the failing test** — `server/lib/dashboardProfiles.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const { DASHBOARD_PROFILE_IDS, isValidProfileId } = require('./dashboardProfiles');

test('exposes the nine profile ids', () => {
  assert.deepEqual(DASHBOARD_PROFILE_IDS, [
    'admin', 'lab-analyze', 'lab-config', 'lab-head', 'lab-inventory',
    'qc-staff', 'qc-reviewer', 'qc-head', 'viewer',
  ]);
});

test('isValidProfileId accepts known ids and empty/null (unset), rejects junk', () => {
  assert.equal(isValidProfileId('qc-head'), true);
  assert.equal(isValidProfileId(''), true);      // unset allowed
  assert.equal(isValidProfileId(null), true);    // unset allowed
  assert.equal(isValidProfileId('bogus'), false);
  assert.equal(isValidProfileId(42), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/dashboardProfiles.test.js`
Expected: FAIL — `Cannot find module './dashboardProfiles'`

- [ ] **Step 3: Write minimal implementation** — `server/lib/dashboardProfiles.js`

```js
const DASHBOARD_PROFILE_IDS = [
  'admin', 'lab-analyze', 'lab-config', 'lab-head', 'lab-inventory',
  'qc-staff', 'qc-reviewer', 'qc-head', 'viewer',
];

function isValidProfileId(id) {
  if (id === null || id === undefined || id === '') return true; // unset
  return typeof id === 'string' && DASHBOARD_PROFILE_IDS.includes(id);
}

module.exports = { DASHBOARD_PROFILE_IDS, isValidProfileId };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/dashboardProfiles.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Add schema field** — `server/models/Role.js`, inside `new mongoose.Schema({...})` after the `permissions` line:

```js
  permissions: { type: [String], default: [] },
  dashboardProfile: { type: String, default: '' },
```

- [ ] **Step 6: Thread into `formatRole`** — `server/routes/accessControl.js:171-178`, replace the function body's return with:

```js
function formatRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description || '',
    locked: role.locked,
    dashboardProfile: role.dashboardProfile || null,
  };
}
```

- [ ] **Step 7: Add `PATCH /roles/:id` route** — `server/routes/accessControl.js`, immediately after the `POST /roles` handler (~line 462). At the top of the file ensure the require exists (add if missing): `const { isValidProfileId } = require('../lib/dashboardProfiles');`

```js
router.patch('/roles/:id', async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.name === 'string') updates.name = req.body.name;
    if (typeof req.body.description === 'string') updates.description = req.body.description;
    if ('dashboardProfile' in req.body) {
      if (!isValidProfileId(req.body.dashboardProfile)) {
        return res.status(400).json({ error: 'invalid dashboardProfile' });
      }
      updates.dashboardProfile = req.body.dashboardProfile || '';
    }
    const role = await Role.findOneAndUpdate({ id: req.params.id }, updates, { new: true });
    if (!role) return res.status(404).json({ error: 'role not found' });
    res.json(formatRole(role));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 8: Commit**

```bash
git add server/lib/dashboardProfiles.js server/lib/dashboardProfiles.test.js server/models/Role.js server/routes/accessControl.js
git commit -m "feat(dashboard): Role.dashboardProfile field + validator + PATCH /roles/:id"
```

---

## Task 2: Client — profile registry + resolvers

**Files:**
- Create: `src/lib/dashboardProfiles.ts`, `src/lib/dashboardProfiles.test.ts`

**Interfaces:**
- Consumes: `primaryRole` from `@/lib/roles`.
- Produces:
  - `type DashboardProfileId` (9 ids)
  - `type KpiId` (union below)
  - `interface KpiMeta { label: string; icon: LucideIcon; variant: StatVariant; drilldownPath?: string }`
  - `type StatVariant = "blue" | "amber" | "green" | "red" | "neutral"` (ตรงกับ StatCard)
  - `type WorkflowKind = "statusDonut" | "pipeline"`
  - `type ChartSpec = { kind: "deptBar" | "normalDonut" | "analystBar" | "withdrawBar" | "requestTrend" | "statusDonut"; title: string }`
  - `type ActivityKind = "audit" | "statusChanges"`
  - `interface DashboardProfile { id; titleEn; subtitleTh; kpis: KpiId[]; workflow: WorkflowKind | null; analytics: ChartSpec[]; activity: ActivityKind }`
  - `KPI_META: Record<KpiId, KpiMeta>`
  - `DASHBOARD_PROFILES: Record<DashboardProfileId, DashboardProfile>`
  - `resolveProfileForRole(roleId: string, roles: {id:string; dashboardProfile?: string|null}[]): DashboardProfileId`
  - `resolveActiveRole(roleIds: string[], stored: string | null): string`

- [ ] **Step 1: Write the failing test** — `src/lib/dashboardProfiles.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  DASHBOARD_PROFILES, KPI_META, resolveProfileForRole, resolveActiveRole,
} from "./dashboardProfiles";

describe("resolveProfileForRole", () => {
  it("uses explicit Role.dashboardProfile when set", () => {
    const roles = [{ id: "qc", dashboardProfile: "qc-head" }];
    expect(resolveProfileForRole("qc", roles)).toBe("qc-head");
  });
  it("falls back to default map when unset", () => {
    const roles = [{ id: "qc", dashboardProfile: null }];
    expect(resolveProfileForRole("qc", roles)).toBe("qc-reviewer");
    expect(resolveProfileForRole("lab", [{ id: "lab" }])).toBe("lab-analyze");
    expect(resolveProfileForRole("admin", [{ id: "admin" }])).toBe("admin");
    expect(resolveProfileForRole("viewer", [{ id: "viewer" }])).toBe("viewer");
  });
  it("falls back by rank prefix then generic viewer", () => {
    expect(resolveProfileForRole("qc-night", [{ id: "qc-night" }])).toBe("qc-reviewer");
    expect(resolveProfileForRole("lab_x", [{ id: "lab_x" }])).toBe("lab-analyze");
    expect(resolveProfileForRole("random", [{ id: "random" }])).toBe("viewer");
    expect(resolveProfileForRole("missing", [])).toBe("viewer");
  });
});

describe("resolveActiveRole", () => {
  it("keeps stored role when the user still holds it", () => {
    expect(resolveActiveRole(["lab", "qc"], "qc")).toBe("qc");
  });
  it("falls back to primaryRole when stored is absent/invalid", () => {
    expect(resolveActiveRole(["lab", "qc"], "admin")).toBe("qc"); // qc outranks lab
    expect(resolveActiveRole(["lab"], null)).toBe("lab");
    expect(resolveActiveRole([], null)).toBe("viewer");
  });
});

describe("registry integrity", () => {
  it("has all nine profiles and every profile's KPIs exist in KPI_META", () => {
    expect(Object.keys(DASHBOARD_PROFILES)).toHaveLength(9);
    for (const p of Object.values(DASHBOARD_PROFILES)) {
      for (const k of p.kpis) expect(KPI_META[k]).toBeDefined();
      expect(p.kpis.length).toBeGreaterThanOrEqual(2);
      expect(p.kpis.length).toBeLessThanOrEqual(6);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboardProfiles.test.ts`
Expected: FAIL — cannot resolve `./dashboardProfiles`

- [ ] **Step 3: Write implementation** — `src/lib/dashboardProfiles.ts`

```ts
import {
  Users, UserCheck, ShieldCheck, FlaskConical, ClipboardList, Hourglass,
  AlertTriangle, CheckCircle2, Package, Droplet, Database, Scale, RotateCcw,
  Gauge, ClipboardCheck, Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { primaryRole } from "@/lib/roles";

export type DashboardProfileId =
  | "admin" | "lab-analyze" | "lab-config" | "lab-head" | "lab-inventory"
  | "qc-staff" | "qc-reviewer" | "qc-head" | "viewer";

export const DASHBOARD_PROFILE_IDS: DashboardProfileId[] = [
  "admin", "lab-analyze", "lab-config", "lab-head", "lab-inventory",
  "qc-staff", "qc-reviewer", "qc-head", "viewer",
];

export type StatVariant = "blue" | "amber" | "green" | "red" | "neutral";

export type KpiId =
  // petition status (current)
  | "petitionsTotal" | "inProgress" | "waitingReceive" | "pendingAssign"
  | "waitingSendLab" | "completedTotal" | "pendingApprovalQc" | "pendingApprovalLab"
  | "assignedToMe" | "activeTotal"
  // time-based (delta today vs yesterday)
  | "completedToday" | "qcApprovedToday" | "withdrawalsToday"
  // flags / approx
  | "abnormalResults" | "returnedTotal" | "normalRateApprox"
  // admin / users
  | "usersTotal" | "usersActive" | "rolesTotal" | "dailyCheckPending"
  // stock
  | "stockLow" | "stockExpiring"
  // config
  | "methodGaps" | "masterItemsTotal";

export interface KpiMeta {
  label: string;
  icon: LucideIcon;
  variant: StatVariant;
  drilldownPath?: string;
}

export const KPI_META: Record<KpiId, KpiMeta> = {
  petitionsTotal:    { label: "คำขอทั้งหมด",   icon: ClipboardList, variant: "neutral", drilldownPath: "/petitions" },
  inProgress:        { label: "กำลังดำเนินการ", icon: FlaskConical,  variant: "blue",    drilldownPath: "/petitions?status=inProgress" },
  waitingReceive:    { label: "รอตรวจรับ",      icon: Hourglass,     variant: "amber",   drilldownPath: "/petitions?status=sampleSent" },
  pendingAssign:     { label: "รอมอบหมาย",      icon: UserCheck,     variant: "blue",    drilldownPath: "/petitions/assign" },
  waitingSendLab:    { label: "รอส่ง Lab",       icon: ClipboardList, variant: "amber",   drilldownPath: "/petitions?status=pendingReview" },
  completedTotal:    { label: "เสร็จสิ้น",       icon: CheckCircle2,  variant: "green",   drilldownPath: "/petitions?status=success" },
  pendingApprovalQc: { label: "รออนุมัติ QC",   icon: ShieldCheck,   variant: "amber",   drilldownPath: "/qc-approval" },
  pendingApprovalLab:{ label: "รออนุมัติ Lab",  icon: ShieldCheck,   variant: "amber",   drilldownPath: "/lab-approval" },
  assignedToMe:      { label: "งานของฉัน",       icon: ClipboardCheck,variant: "blue",    drilldownPath: "/lab-testing" },
  activeTotal:       { label: "งานกำลังทำ",     icon: FlaskConical,  variant: "blue",    drilldownPath: "/petitions" },
  completedToday:    { label: "เสร็จวันนี้",     icon: CheckCircle2,  variant: "green" },
  qcApprovedToday:   { label: "อนุมัติวันนี้",   icon: CheckCircle2,  variant: "green" },
  withdrawalsToday:  { label: "เบิกวันนี้",      icon: Package,       variant: "blue",    drilldownPath: "/stock-deduction" },
  abnormalResults:   { label: "ผลผิดปกติ",       icon: AlertTriangle, variant: "red",     drilldownPath: "/record-results" },
  returnedTotal:     { label: "งานตีกลับ",       icon: RotateCcw,     variant: "red",     drilldownPath: "/petitions" },
  normalRateApprox:  { label: "อัตราปกติ",       icon: Gauge,         variant: "green" },
  usersTotal:        { label: "ผู้ใช้ทั้งหมด",   icon: Users,         variant: "neutral", drilldownPath: "/access-control" },
  usersActive:       { label: "ผู้ใช้ที่ใช้งาน", icon: UserCheck,     variant: "green",   drilldownPath: "/access-control" },
  rolesTotal:        { label: "จำนวน Role",      icon: ShieldCheck,   variant: "neutral", drilldownPath: "/access-control" },
  dailyCheckPending: { label: "Daily Check ค้าง", icon: Scale,        variant: "amber",   drilldownPath: "/daily-check" },
  stockLow:          { label: "สต๊อกต่ำ",        icon: Droplet,       variant: "amber",   drilldownPath: "/stock" },
  stockExpiring:     { label: "ใกล้หมดอายุ",     icon: AlertTriangle, variant: "red",     drilldownPath: "/stock" },
  methodGaps:        { label: "Method ยังขาด",   icon: FlaskConical,  variant: "amber",   drilldownPath: "/simple-method" },
  masterItemsTotal:  { label: "รายการสินค้า",    icon: Database,      variant: "neutral", drilldownPath: "/master-items" },
};

export type WorkflowKind = "statusDonut" | "pipeline";
export type ChartKind = "deptBar" | "normalDonut" | "analystBar" | "withdrawBar" | "requestTrend" | "statusDonut";
export interface ChartSpec { kind: ChartKind; title: string }
export type ActivityKind = "audit" | "statusChanges";

export interface DashboardProfile {
  id: DashboardProfileId;
  titleEn: string;
  subtitleTh: string;
  kpis: KpiId[];
  workflow: WorkflowKind | null;
  analytics: ChartSpec[];
  activity: ActivityKind;
}

export const DASHBOARD_PROFILES: Record<DashboardProfileId, DashboardProfile> = {
  admin: {
    id: "admin", titleEn: "Administrator Dashboard", subtitleTh: "ภาพรวมระบบ · ผู้ใช้ · งานค้าง",
    kpis: ["usersTotal", "usersActive", "rolesTotal", "activeTotal", "dailyCheckPending"],
    workflow: "statusDonut",
    analytics: [{ kind: "deptBar", title: "งานต่อแผนก" }, { kind: "statusDonut", title: "สัดส่วนสถานะคำขอ" }],
    activity: "audit",
  },
  "lab-analyze": {
    id: "lab-analyze", titleEn: "Lab Analyze Dashboard", subtitleTh: "งานวิเคราะห์ของฉัน",
    kpis: ["assignedToMe", "inProgress", "completedToday", "returnedTotal"],
    workflow: "statusDonut",
    analytics: [{ kind: "statusDonut", title: "สถานะงานของฉัน" }],
    activity: "statusChanges",
  },
  "lab-config": {
    id: "lab-config", titleEn: "Lab Data Config Dashboard", subtitleTh: "วิธีวิเคราะห์ · รายการสินค้า",
    kpis: ["methodGaps", "masterItemsTotal"],
    workflow: null,
    analytics: [],
    activity: "statusChanges",
  },
  "lab-head": {
    id: "lab-head", titleEn: "Lab Head Dashboard", subtitleTh: "อนุมัติ · ผิดปกติ · ภาระงาน",
    kpis: ["pendingApprovalLab", "abnormalResults", "activeTotal", "completedToday"],
    workflow: "pipeline",
    analytics: [{ kind: "analystBar", title: "ภาระงานต่อผู้วิเคราะห์" }],
    activity: "statusChanges",
  },
  "lab-inventory": {
    id: "lab-inventory", titleEn: "Lab Inventory Dashboard", subtitleTh: "สต๊อก · หมดอายุ · การเบิก",
    kpis: ["stockLow", "stockExpiring", "withdrawalsToday"],
    workflow: null,
    analytics: [{ kind: "withdrawBar", title: "การเบิกต่อวัน" }],
    activity: "statusChanges",
  },
  "qc-staff": {
    id: "qc-staff", titleEn: "QC Staff Dashboard", subtitleTh: "รับตัวอย่าง · ส่ง Lab · ติดตาม",
    kpis: ["assignedToMe", "waitingReceive", "waitingSendLab", "completedToday", "returnedTotal"],
    workflow: "pipeline",
    analytics: [{ kind: "statusDonut", title: "สัดส่วนสถานะ" }],
    activity: "statusChanges",
  },
  "qc-reviewer": {
    id: "qc-reviewer", titleEn: "QC Reviewer Dashboard", subtitleTh: "ตรวจทาน · อนุมัติผล",
    kpis: ["pendingApprovalQc", "abnormalResults", "returnedTotal", "qcApprovedToday"],
    workflow: "statusDonut",
    analytics: [{ kind: "normalDonut", title: "ปกติ / ผิดปกติ" }],
    activity: "statusChanges",
  },
  "qc-head": {
    id: "qc-head", titleEn: "QC Head Dashboard", subtitleTh: "อนุมัติ · ผิดปกติ · ประสิทธิภาพ",
    kpis: ["pendingApprovalQc", "abnormalResults", "normalRateApprox", "activeTotal"],
    workflow: "statusDonut",
    analytics: [{ kind: "deptBar", title: "งานต่อแผนก" }, { kind: "normalDonut", title: "ปกติ / ผิดปกติ" }],
    activity: "audit",
  },
  viewer: {
    id: "viewer", titleEn: "Viewer Dashboard", subtitleTh: "ภาพรวมผู้บริหาร (อ่านอย่างเดียว)",
    kpis: ["petitionsTotal", "inProgress", "completedTotal", "normalRateApprox"],
    workflow: "statusDonut",
    analytics: [{ kind: "statusDonut", title: "สัดส่วนสถานะ" }, { kind: "requestTrend", title: "คำขอต่อวัน (ในช่วงข้อมูล)" }],
    activity: "statusChanges",
  },
};

const DEFAULT_PROFILE_MAP: Record<string, DashboardProfileId> = {
  admin: "admin", qc: "qc-reviewer", lab: "lab-analyze", viewer: "viewer",
};

/** role.id → profile: explicit dashboardProfile wins, else default map, else rank prefix, else viewer. */
export function resolveProfileForRole(
  roleId: string,
  roles: { id: string; dashboardProfile?: string | null }[],
): DashboardProfileId {
  const explicit = roles.find((r) => r.id === roleId)?.dashboardProfile;
  if (explicit && DASHBOARD_PROFILE_IDS.includes(explicit as DashboardProfileId)) {
    return explicit as DashboardProfileId;
  }
  if (DEFAULT_PROFILE_MAP[roleId]) return DEFAULT_PROFILE_MAP[roleId];
  if (roleId === "qc" || roleId.startsWith("qc-") || roleId.startsWith("qc_")) return "qc-reviewer";
  if (roleId === "lab" || roleId.startsWith("lab-") || roleId.startsWith("lab_")) return "lab-analyze";
  if (roleId === "admin") return "admin";
  return "viewer";
}

/** stored active role wins if the user still holds it, else primaryRole. */
export function resolveActiveRole(roleIds: string[], stored: string | null): string {
  if (stored && roleIds.includes(stored)) return stored;
  return primaryRole(roleIds);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboardProfiles.test.ts`
Expected: PASS (all describes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardProfiles.ts src/lib/dashboardProfiles.test.ts
git commit -m "feat(dashboard): profile registry + role/active-role resolvers"
```

---

## Task 3: `dateShift.ts` — Thai date / shift / greeting (extract from HomeHeader, DRY)

**Files:**
- Create: `src/lib/dateShift.ts`, `src/lib/dateShift.test.ts`
- Modify: `src/components/home/HomeHeader.tsx` (reuse)

**Interfaces:**
- Produces: `formatThaiDate(d: Date): string`, `currentShift(d: Date): "กะเช้า" | "กะบ่าย"`, `greetForHour(h: number): string`, `SHIFT_SWITCH_HOUR = 12`.

- [ ] **Step 1: Write the failing test** — `src/lib/dateShift.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { currentShift, greetForHour, SHIFT_SWITCH_HOUR } from "./dateShift";

describe("currentShift", () => {
  it("morning before 12:00 is กะเช้า, noon+ is กะบ่าย", () => {
    expect(currentShift(new Date(2026, 6, 6, 8, 0))).toBe("กะเช้า");
    expect(currentShift(new Date(2026, 6, 6, 11, 59))).toBe("กะเช้า");
    expect(currentShift(new Date(2026, 6, 6, 12, 0))).toBe("กะบ่าย");
    expect(currentShift(new Date(2026, 6, 6, 18, 0))).toBe("กะบ่าย");
  });
});

describe("greetForHour", () => {
  it("maps hour to Thai greeting", () => {
    expect(greetForHour(9)).toBe("อรุณสวัสดิ์");
    expect(greetForHour(14)).toBe("สวัสดีตอนบ่าย");
    expect(greetForHour(19)).toBe("สวัสดีตอนเย็น");
  });
  it("SHIFT_SWITCH_HOUR is noon", () => expect(SHIFT_SWITCH_HOUR).toBe(12));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dateShift.test.ts`
Expected: FAIL — cannot resolve `./dateShift`

- [ ] **Step 3: Write implementation** — `src/lib/dateShift.ts`

```ts
export const SHIFT_SWITCH_HOUR = 12;

export function greetForHour(h: number): string {
  if (h < 12) return "อรุณสวัสดิ์";
  if (h < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

export function currentShift(d: Date): "กะเช้า" | "กะบ่าย" {
  return d.getHours() < SHIFT_SWITCH_HOUR ? "กะเช้า" : "กะบ่าย";
}

export function formatThaiDate(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dateShift.test.ts`
Expected: PASS

- [ ] **Step 5: Refactor HomeHeader to reuse** — `src/components/home/HomeHeader.tsx`: delete local `SHIFT_SWITCH_HOUR`, `greetForHour`, and inline date/shift; import from `@/lib/dateShift` and use `formatThaiDate(now)`, `greetForHour(now.getHours())`, `currentShift(now)`. (HomeHeader ยังใช้อยู่จนกว่าจะลบ Home* ใน Task 16 — จึงต้องไม่พัง)

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
```bash
git add src/lib/dateShift.ts src/lib/dateShift.test.ts src/components/home/HomeHeader.tsx
git commit -m "refactor(dashboard): extract dateShift helpers, reuse in HomeHeader"
```

---

## Task 4: `dashboardMetrics.ts` — pure compute (KPI + chart datasets)

**Files:**
- Create: `src/lib/dashboardMetrics.ts`, `src/lib/dashboardMetrics.test.ts`

**Interfaces:**
- Consumes: `Petition`, `PetitionStatus`, `PETITION_STATUS_CONFIG`, `PETITION_DEPT_LABELS` from `@/types/petition.types`; `KpiId` from `@/lib/dashboardProfiles`.
- Produces:
  - `interface MetricsCtx { petitions: Petition[]; now: number; abnormalFlags: Record<string,boolean>; returnedFlags: Record<string,boolean>; pendingQcCount: number; assignedToMeCount: number; usersTotal: number; usersActive: number; rolesTotal: number; dailyCheckPending: number; stockLow: number; stockExpiring: number; withdrawalsToday: number; withdrawalsYesterday: number; qcApprovedToday: number; qcApprovedYesterday: number; methodGaps: number; masterItemsTotal: number; }`
  - `interface KpiValue { value: number; delta?: number }`
  - `computeKpi(id: KpiId, ctx: MetricsCtx): KpiValue`
  - helpers: `ageHours(iso, now)`, `isSameLocalDay(iso, now)`, `isPrevLocalDay(iso, now)`, `countByStatus(petitions)`, `statusDonutData(petitions)`, `pipelineStages(petitions)`, `deptWorkloadData(petitions)`, `analystWorkloadData(petitions)`, `normalDonutData(petitions, abnormalFlags)`, `requestTrendData(petitions, now, days)`, `completedIn(petitions, now, dayOffset)`

- [ ] **Step 1: Write the failing test** — `src/lib/dashboardMetrics.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  ageHours, isSameLocalDay, countByStatus, statusDonutData, deptWorkloadData,
  normalDonutData, requestTrendData, completedIn, computeKpi, type MetricsCtx,
} from "./dashboardMetrics";
import type { Petition } from "@/types/petition.types";

const NOW = new Date(2026, 6, 6, 15, 0).getTime(); // 6 Jul 2026 15:00 local

function pet(over: Partial<Petition>): Petition {
  return {
    _id: over._id ?? Math.random().toString(36),
    petitionNo: "P-1", dept: "production", status: "inProgress",
    submittedBy: { name: "somchai", submittedAt: "2026-07-06T01:00:00Z" },
    items: [{ seq: 1, sampleName: "S", batchNo: "B" }],
    createdAt: "2026-07-06T01:00:00.000Z", updatedAt: "2026-07-06T01:00:00.000Z",
    ...over,
  } as Petition;
}

describe("date helpers", () => {
  it("ageHours computes elapsed hours, clamped >= 0", () => {
    const twoHoursAgo = new Date(NOW - 2 * 3600_000).toISOString();
    expect(ageHours(twoHoursAgo, NOW)).toBe(2);
    expect(ageHours(null, NOW)).toBeNull();
  });
  it("isSameLocalDay true for same calendar day", () => {
    expect(isSameLocalDay(new Date(2026, 6, 6, 9).toISOString(), NOW)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 6, 5, 9).toISOString(), NOW)).toBe(false);
  });
});

describe("aggregations", () => {
  const list = [
    pet({ status: "inProgress" }), pet({ status: "inProgress" }),
    pet({ status: "success" }), pet({ status: "sampleSent" }),
    pet({ dept: "rm", status: "success" }),
  ];
  it("countByStatus tallies each status", () => {
    expect(countByStatus(list).inProgress).toBe(2);
    expect(countByStatus(list).success).toBe(2);
    expect(countByStatus(list).sampleSent).toBe(1);
  });
  it("statusDonutData returns only non-zero slices with labels+colors", () => {
    const d = statusDonutData(list);
    expect(d.every((s) => s.value > 0)).toBe(true);
    expect(d.find((s) => s.key === "inProgress")?.value).toBe(2);
    expect(d.find((s) => s.key === "inProgress")?.label).toBeTruthy();
  });
  it("deptWorkloadData groups by dept label", () => {
    const d = deptWorkloadData(list);
    expect(d.find((x) => x.dept === "production")?.count).toBe(4);
    expect(d.find((x) => x.dept === "rm")?.count).toBe(1);
  });
  it("normalDonutData splits abnormal vs normal by flags", () => {
    const flags = { [list[0]._id]: true };
    const d = normalDonutData(list, flags);
    expect(d.find((x) => x.key === "abnormal")?.value).toBe(1);
    expect(d.find((x) => x.key === "normal")?.value).toBe(4);
  });
  it("requestTrendData buckets last N days by createdAt", () => {
    const d = requestTrendData(list, NOW, 7);
    expect(d).toHaveLength(7);
    expect(d[d.length - 1].count).toBe(5); // all created today
  });
  it("completedIn counts success/approved on a given local day offset", () => {
    const today = [
      pet({ status: "success", completedAt: new Date(NOW).toISOString() }),
      pet({ status: "approved", completedAt: new Date(NOW).toISOString() }),
      pet({ status: "success", completedAt: new Date(NOW - 86400_000).toISOString() }),
    ];
    expect(completedIn(today, NOW, 0)).toBe(2);
    expect(completedIn(today, NOW, 1)).toBe(1);
  });
});

describe("computeKpi", () => {
  const ctx: MetricsCtx = {
    petitions: [
      pet({ _id: "a", status: "inProgress" }),
      pet({ _id: "b", status: "success", completedAt: new Date(NOW).toISOString() }),
      pet({ _id: "c", status: "sampleSent" }),
    ],
    now: NOW,
    abnormalFlags: { a: true }, returnedFlags: { c: true },
    pendingQcCount: 4, assignedToMeCount: 2,
    usersTotal: 10, usersActive: 7, rolesTotal: 4, dailyCheckPending: 1,
    stockLow: 3, stockExpiring: 2, withdrawalsToday: 5, withdrawalsYesterday: 3,
    qcApprovedToday: 6, qcApprovedYesterday: 4, methodGaps: 9, masterItemsTotal: 120,
  };
  it("status counts", () => {
    expect(computeKpi("inProgress", ctx).value).toBe(1);
    expect(computeKpi("waitingReceive", ctx).value).toBe(1);
    expect(computeKpi("petitionsTotal", ctx).value).toBe(3);
  });
  it("flags + passthrough ctx numbers", () => {
    expect(computeKpi("abnormalResults", ctx).value).toBe(1);
    expect(computeKpi("returnedTotal", ctx).value).toBe(1);
    expect(computeKpi("usersActive", ctx).value).toBe(7);
    expect(computeKpi("methodGaps", ctx).value).toBe(9);
  });
  it("time-based KPIs carry delta today-minus-yesterday", () => {
    expect(computeKpi("withdrawalsToday", ctx)).toEqual({ value: 5, delta: 2 });
    expect(computeKpi("qcApprovedToday", ctx)).toEqual({ value: 6, delta: 2 });
  });
  it("normalRateApprox = round(100*(1-abnormal/total))", () => {
    expect(computeKpi("normalRateApprox", ctx).value).toBe(67); // 1 abnormal of 3
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboardMetrics.test.ts`
Expected: FAIL — cannot resolve `./dashboardMetrics`

- [ ] **Step 3: Write implementation** — `src/lib/dashboardMetrics.ts`

```ts
import {
  PETITION_STATUS_CONFIG, PETITION_DEPT_LABELS,
  type Petition, type PetitionStatus, type PetitionDept,
} from "@/types/petition.types";
import type { KpiId } from "@/lib/dashboardProfiles";

export interface MetricsCtx {
  petitions: Petition[];
  now: number;
  abnormalFlags: Record<string, boolean>;
  returnedFlags: Record<string, boolean>;
  pendingQcCount: number;
  assignedToMeCount: number;
  usersTotal: number;
  usersActive: number;
  rolesTotal: number;
  dailyCheckPending: number;
  stockLow: number;
  stockExpiring: number;
  withdrawalsToday: number;
  withdrawalsYesterday: number;
  qcApprovedToday: number;
  qcApprovedYesterday: number;
  methodGaps: number;
  masterItemsTotal: number;
}

export interface KpiValue { value: number; delta?: number }

// ---- date helpers ----
export function ageHours(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 3_600_000));
}
function startOfLocalDay(now: number, dayOffset = 0): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOffset);
  return d.getTime();
}
export function isSameLocalDay(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= startOfLocalDay(now, 0) && t < startOfLocalDay(now, -1);
}
export function isPrevLocalDay(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= startOfLocalDay(now, 1) && t < startOfLocalDay(now, 0);
}

// ---- aggregations ----
const STATUS_COLORS: Record<PetitionStatus, string> = {
  deliveringQC: "hsl(215,16%,60%)",
  sampleSent: "hsl(217,91%,60%)",
  pendingReview: "hsl(38,92%,50%)",
  inProgress: "hsl(217,91%,55%)",
  success: "hsl(142,71%,45%)",
  approved: "hsl(142,71%,40%)",
  rejected: "hsl(0,72%,51%)",
};

export function countByStatus(petitions: Petition[]): Record<PetitionStatus, number> {
  const out = {
    deliveringQC: 0, sampleSent: 0, pendingReview: 0, inProgress: 0,
    success: 0, approved: 0, rejected: 0,
  } as Record<PetitionStatus, number>;
  for (const p of petitions) out[p.status] = (out[p.status] ?? 0) + 1;
  return out;
}

export function statusDonutData(petitions: Petition[]) {
  const counts = countByStatus(petitions);
  return (Object.keys(counts) as PetitionStatus[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ key: k, label: PETITION_STATUS_CONFIG[k].label, value: counts[k], color: STATUS_COLORS[k] }));
}

const PIPELINE: { key: PetitionStatus; label: string }[] = [
  { key: "sampleSent", label: "รอรับ" },
  { key: "pendingReview", label: "รับแล้ว" },
  { key: "inProgress", label: "กำลังตรวจ" },
  { key: "success", label: "เสร็จ" },
];
export function pipelineStages(petitions: Petition[]) {
  const counts = countByStatus(petitions);
  return PIPELINE.map((s) => ({ key: s.key, label: s.label, count: counts[s.key] }));
}

export function deptWorkloadData(petitions: Petition[]) {
  const by = {} as Record<PetitionDept, number>;
  for (const p of petitions) by[p.dept] = (by[p.dept] ?? 0) + 1;
  return (Object.keys(PETITION_DEPT_LABELS) as PetitionDept[])
    .map((d) => ({ dept: d, label: PETITION_DEPT_LABELS[d], count: by[d] ?? 0 }))
    .filter((x) => x.count > 0);
}

export function analystWorkloadData(petitions: Petition[]) {
  const by = new Map<string, number>();
  for (const p of petitions) {
    if (p.status !== "inProgress") continue;
    const name = p.assignedTo?.name?.trim();
    if (!name) continue;
    by.set(name, (by.get(name) ?? 0) + 1);
  }
  return [...by.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function normalDonutData(petitions: Petition[], abnormalFlags: Record<string, boolean>) {
  let abnormal = 0;
  for (const p of petitions) if (abnormalFlags[p._id]) abnormal += 1;
  const normal = petitions.length - abnormal;
  return [
    { key: "normal", label: "ปกติ", value: normal, color: "hsl(142,71%,45%)" },
    { key: "abnormal", label: "ผิดปกติ", value: abnormal, color: "hsl(0,72%,51%)" },
  ].filter((x) => x.value > 0);
}

export function requestTrendData(petitions: Petition[], now: number, days: number) {
  const buckets: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = startOfLocalDay(now, i);
    const end = startOfLocalDay(now, i - 1);
    const label = new Date(start).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    const count = petitions.filter((p) => {
      const t = new Date(p.createdAt).getTime();
      return t >= start && t < end;
    }).length;
    buckets.push({ date: label, count });
  }
  return buckets;
}

/** success/approved whose completedAt (fallback approvedAt/updatedAt) lands on local day `dayOffset`. */
export function completedIn(petitions: Petition[], now: number, dayOffset: number): number {
  const start = startOfLocalDay(now, dayOffset);
  const end = startOfLocalDay(now, dayOffset - 1);
  return petitions.filter((p) => {
    if (p.status !== "success" && p.status !== "approved") return false;
    const iso = p.completedAt ?? p.approvedAt ?? p.updatedAt;
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  }).length;
}

function countStatus(petitions: Petition[], status: PetitionStatus): number {
  return petitions.filter((p) => p.status === status).length;
}
function countFlags(flags: Record<string, boolean>): number {
  return Object.values(flags).filter(Boolean).length;
}

// ---- KPI dispatch ----
export function computeKpi(id: KpiId, ctx: MetricsCtx): KpiValue {
  const P = ctx.petitions;
  switch (id) {
    case "petitionsTotal": return { value: P.length };
    case "inProgress": return { value: countStatus(P, "inProgress") };
    case "waitingReceive": return { value: countStatus(P, "sampleSent") };
    case "pendingAssign": return { value: countStatus(P, "pendingReview") };
    case "waitingSendLab": return { value: countStatus(P, "pendingReview") };
    case "completedTotal": return { value: countStatus(P, "success") + countStatus(P, "approved") };
    case "activeTotal":
      return { value: countStatus(P, "inProgress") + countStatus(P, "pendingReview") + countStatus(P, "sampleSent") };
    case "pendingApprovalQc": return { value: ctx.pendingQcCount };
    case "pendingApprovalLab": return { value: countStatus(P, "inProgress") };
    case "assignedToMe": return { value: ctx.assignedToMeCount };
    case "completedToday":
      return { value: completedIn(P, ctx.now, 0), delta: completedIn(P, ctx.now, 0) - completedIn(P, ctx.now, 1) };
    case "qcApprovedToday":
      return { value: ctx.qcApprovedToday, delta: ctx.qcApprovedToday - ctx.qcApprovedYesterday };
    case "withdrawalsToday":
      return { value: ctx.withdrawalsToday, delta: ctx.withdrawalsToday - ctx.withdrawalsYesterday };
    case "abnormalResults": return { value: countFlags(ctx.abnormalFlags) };
    case "returnedTotal": return { value: countFlags(ctx.returnedFlags) };
    case "normalRateApprox": {
      const total = P.length;
      const abn = countFlags(ctx.abnormalFlags);
      return { value: total === 0 ? 100 : Math.round(100 * (1 - abn / total)) };
    }
    case "usersTotal": return { value: ctx.usersTotal };
    case "usersActive": return { value: ctx.usersActive };
    case "rolesTotal": return { value: ctx.rolesTotal };
    case "dailyCheckPending": return { value: ctx.dailyCheckPending };
    case "stockLow": return { value: ctx.stockLow };
    case "stockExpiring": return { value: ctx.stockExpiring };
    case "methodGaps": return { value: ctx.methodGaps };
    case "masterItemsTotal": return { value: ctx.masterItemsTotal };
    default: return { value: 0 };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboardMetrics.test.ts`
Expected: PASS (all describes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardMetrics.ts src/lib/dashboardMetrics.test.ts
git commit -m "feat(dashboard): pure KPI + chart-dataset compute with fixtures"
```

---

## Task 5: `activeRole.ts` — module store + `useActiveRole` hook

**Files:**
- Create: `src/store/activeRole.ts`, `src/store/activeRole.test.ts`

**Interfaces:**
- Consumes: `resolveActiveRole` from `@/lib/dashboardProfiles`.
- Produces:
  - `getStoredActiveRole(): string | null`, `setActiveRole(roleId: string): void`, `subscribeActiveRole(cb: () => void): () => void` (module store, localStorage key `"lis.activeRole"`)
  - `useActiveRole(roleIds: string[]): { activeRole: string; setActiveRole: (id: string) => void }` (uses `useSyncExternalStore` + `resolveActiveRole`)

- [ ] **Step 1: Write the failing test** — `src/store/activeRole.test.ts`

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredActiveRole, setActiveRole, subscribeActiveRole } from "./activeRole";

beforeEach(() => localStorage.clear());

describe("activeRole store", () => {
  it("persists to localStorage and reads back", () => {
    expect(getStoredActiveRole()).toBeNull();
    setActiveRole("qc");
    expect(getStoredActiveRole()).toBe("qc");
    expect(localStorage.getItem("lis.activeRole")).toBe("qc");
  });
  it("notifies subscribers on change", () => {
    const cb = vi.fn();
    const unsub = subscribeActiveRole(cb);
    setActiveRole("lab");
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    setActiveRole("admin");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/activeRole.test.ts`
Expected: FAIL — cannot resolve `./activeRole`

- [ ] **Step 3: Write implementation** — `src/store/activeRole.ts`

```ts
import { useSyncExternalStore, useCallback } from "react";
import { resolveActiveRole } from "@/lib/dashboardProfiles";

const KEY = "lis.activeRole";
const listeners = new Set<() => void>();

export function getStoredActiveRole(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setActiveRole(roleId: string): void {
  try { localStorage.setItem(KEY, roleId); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribeActiveRole(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveRole(roleIds: string[]) {
  const stored = useSyncExternalStore(subscribeActiveRole, getStoredActiveRole, () => null);
  const activeRole = resolveActiveRole(roleIds, stored);
  const set = useCallback((id: string) => setActiveRole(id), []);
  return { activeRole, setActiveRole: set };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/activeRole.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/activeRole.ts src/store/activeRole.test.ts
git commit -m "feat(dashboard): active-role store + useActiveRole hook"
```

---

## Task 6: `useDashboardData` — orchestrator hook

**Files:**
- Create: `src/hooks/useDashboardData.ts`

**Interfaces:**
- Consumes: `usePetitionList` (`@/hooks/usePetition`), `useSamples` (`@/context/SampleContext`), `useAuth` (`@/context/AuthContext`), `api` (`@/lib/api`), `useQuery` (`@tanstack/react-query`), `loadAccessControl` (`@/lib/accessControlSource`), `computeKpi`, `MetricsCtx`, `statusDonutData`, `pipelineStages`, `deptWorkloadData`, `analystWorkloadData`, `normalDonutData`, `requestTrendData` (`@/lib/dashboardMetrics`), `DashboardProfile` (`@/lib/dashboardProfiles`).
- Produces: `useDashboardData(profile: DashboardProfile): DashboardData` where
  `interface DashboardData { petitions: Petition[]; ctx: MetricsCtx; loading: boolean; refresh: () => void }`
  (KPI/chart consumers call the pure fns with `ctx`/`petitions` themselves.)

> **Note (Global Constraint — data window):** fetch petitions with `limit: 200`. Add a code comment: `// caveat: totals/trend bounded to the fetched window (real-only, no server aggregate)`.
> **Note:** `assignedToMeCount` matches `assignedTo` against the current user. Verify `PetitionAssignee` shape at implement time; default match = `p.assignedTo?.employeeId === user.employeeId || p.assignedTo?.name === user.name`.
> **Note:** `methodGaps` needs `/master-items/slim` + simple-method commonNames. Fetch `/simple-methods` (verify shape) → build `Set` of commonNames present; gap = slim commonNames not in the set. If `/simple-methods` shape is uncertain at implement time, compute `methodGaps` = count of slim items with a blank/missing `commonName` as an interim real signal and leave a `// TODO verify simple-method source` — but DO NOT fabricate a number.

- [ ] **Step 1: Write implementation** — `src/hooks/useDashboardData.ts`

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePetitionList } from "@/hooks/usePetition";
import { useSamples } from "@/context/SampleContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { loadAccessControl } from "@/lib/accessControlSource";
import type { DashboardProfile } from "@/lib/dashboardProfiles";
import type { MetricsCtx } from "@/lib/dashboardMetrics";
import type { Petition } from "@/types/petition.types";

const EXPIRY_WARN_DAYS = 180;
const SOLVENT_LOW_QTY = 3;

function daysUntil(iso?: string | null): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export interface DashboardData {
  petitions: Petition[];
  ctx: MetricsCtx;
  loading: boolean;
  refresh: () => void;
}

export function useDashboardData(profile: DashboardProfile): DashboardData {
  const { user } = useAuth();
  const kpis = new Set(profile.kpis);
  const need = (id: string) => kpis.has(id as never);

  // caveat: totals/trend bounded to the fetched window (real-only, no server aggregate)
  const { data: petData, loading, refresh } = usePetitionList({ page: 1, limit: 200 });
  const petitions = petData?.items ?? [];
  const ids = petitions.map((p) => p._id);

  const { doneSamples, approvals } = useSamples();

  const wantAbnormal = need("abnormalResults") || need("normalRateApprox") || profile.analytics.some((a) => a.kind === "normalDonut");
  const wantReturned = need("returnedTotal");
  const { data: abnormalFlags = {} } = useQuery({
    queryKey: ["dash", "abnormal", ids], enabled: wantAbnormal && ids.length > 0,
    queryFn: () => api.getAbnormalFlags(ids),
  });
  const { data: returnedFlags = {} } = useQuery({
    queryKey: ["dash", "returned", ids], enabled: wantReturned && ids.length > 0,
    queryFn: () => api.getReturnedFlags(ids),
  });

  const wantStock = need("stockLow") || need("stockExpiring");
  const { data: solvents = [] } = useQuery({ queryKey: ["dash", "solvents"], enabled: wantStock, queryFn: api.getSolvents });
  const { data: standards = [] } = useQuery({ queryKey: ["dash", "standards"], enabled: wantStock, queryFn: api.getStandards });

  const wantWithdraw = need("withdrawalsToday") || profile.analytics.some((a) => a.kind === "withdrawBar");
  const { data: txns = [] } = useQuery({
    queryKey: ["dash", "txns"], enabled: wantWithdraw,
    queryFn: () => api.getStockTransactions({ action: "withdraw", limit: 500 }),
  });

  const wantDaily = need("dailyCheckPending");
  const { data: dailySummary } = useQuery({ queryKey: ["dash", "daily"], enabled: wantDaily, queryFn: api.getDailyCheckTodaySummary });

  const wantUsers = need("usersTotal") || need("usersActive") || need("rolesTotal");
  const { data: access } = useQuery({ queryKey: ["access-control"], enabled: wantUsers, queryFn: loadAccessControl });

  const wantConfig = need("methodGaps") || need("masterItemsTotal");
  const { data: slim = [] } = useQuery({
    queryKey: ["dash", "slim"], enabled: wantConfig,
    queryFn: () => api.get<{ itemNo?: string; commonName?: string }[]>("/master-items/slim").then((r) => r.data.data),
  });

  const ctx: MetricsCtx = useMemo(() => {
    const now = Date.now();
    const isToday = (iso?: string | null) => {
      if (!iso) return false;
      const d = new Date(iso); const n = new Date(now);
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    };
    const isYesterday = (iso?: string | null) => {
      if (!iso) return false;
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const d = new Date(iso);
      return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
    };
    const pendingQcCount = doneSamples.filter(
      (s) => !approvals[s.id]?.qcStatus || approvals[s.id]?.qcStatus === "pending",
    ).length;
    const assignedToMeCount = petitions.filter(
      (p) => p.status === "inProgress" &&
        (!!user?.employeeId && p.assignedTo?.employeeId === user.employeeId ||
         !!user?.name && p.assignedTo?.name === user.name),
    ).length;
    const commonNamesWithMethod = new Set<string>(); // TODO verify /simple-methods source; interim below
    const methodGaps = slim.filter((s) => !s.commonName || !commonNamesWithMethod.has(s.commonName)).length;

    return {
      petitions, now, abnormalFlags, returnedFlags, pendingQcCount, assignedToMeCount,
      usersTotal: access?.users?.length ?? 0,
      usersActive: access?.users?.filter((u: { status?: string }) => u.status !== "inactive").length ?? 0,
      rolesTotal: access?.roles?.length ?? 0,
      dailyCheckPending: dailySummary && !dailySummary.allPass ? 1 : 0,
      stockLow: solvents.filter((s) => (s.qty ?? 0) < SOLVENT_LOW_QTY).length,
      stockExpiring: standards.filter((s) =>
        Math.min(daysUntil(s.working?.exp), daysUntil(s.supplier?.exp)) <= EXPIRY_WARN_DAYS).length,
      withdrawalsToday: txns.filter((t: { createdAt?: string }) => isToday(t.createdAt)).length,
      withdrawalsYesterday: txns.filter((t: { createdAt?: string }) => isYesterday(t.createdAt)).length,
      qcApprovedToday: petitions.filter((p) => p.status === "approved" && isToday(p.approvedAt)).length,
      qcApprovedYesterday: petitions.filter((p) => p.status === "approved" && isYesterday(p.approvedAt)).length,
      methodGaps: wantConfig ? methodGaps : 0,
      masterItemsTotal: slim.length,
    };
  }, [petitions, doneSamples, approvals, user, abnormalFlags, returnedFlags, solvents, standards, txns, dailySummary, access, slim, wantConfig]);

  return { petitions, ctx, loading, refresh };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors. (Fix any shape mismatch on `StockStandardItem`/`StockSolventItem`/`StockTransactionItem`/access-control types by reading their defs in `src/lib/api.ts` / `src/lib/accessControlSource.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDashboardData.ts
git commit -m "feat(dashboard): useDashboardData orchestrator (real sources, per-profile fetch gating)"
```

---

## Task 7: `ActiveRoleSwitcher` + `DashboardHeader`

**Files:**
- Create: `src/components/dashboard/ActiveRoleSwitcher.tsx`, `src/components/dashboard/DashboardHeader.tsx`, `src/components/dashboard/DashboardHeader.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useActiveRole` (`@/store/activeRole`), `normalizeRoles` (`@/lib/roles`), `formatThaiDate`/`currentShift`/`greetForHour` (`@/lib/dateShift`), shadcn `Select`, `Button`, lucide icons.
- Produces:
  - `ActiveRoleSwitcher({ roles, activeRole, onChange, roleNames }: { roles: string[]; activeRole: string; onChange: (r: string) => void; roleNames: Record<string,string> })` — dropdown; renders a static chip when `roles.length <= 1`.
  - `DashboardHeader({ titleEn, subtitleTh, range, onRangeChange, onRefresh, onExport }: { titleEn: string; subtitleTh: string; range: DashRange; onRangeChange: (r: DashRange) => void; onRefresh: () => void; onExport: () => void })` where `type DashRange = "today" | "7d" | "30d"`.

- [ ] **Step 1: Write ActiveRoleSwitcher** — `src/components/dashboard/ActiveRoleSwitcher.tsx`

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle } from "lucide-react";

interface Props {
  roles: string[];
  activeRole: string;
  onChange: (r: string) => void;
  roleNames: Record<string, string>;
}

export default function ActiveRoleSwitcher({ roles, activeRole, onChange, roleNames }: Props) {
  const nameOf = (id: string) => roleNames[id] ?? id;
  if (roles.length <= 1) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium">
        <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
        {nameOf(activeRole)}
      </div>
    );
  }
  return (
    <Select value={activeRole} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[190px] gap-1.5">
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r}>{nameOf(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Write DashboardHeader** — `src/components/dashboard/DashboardHeader.tsx`

```tsx
import { useAuth } from "@/context/AuthContext";
import { useActiveRole } from "@/store/activeRole";
import { normalizeRoles } from "@/lib/roles";
import { formatThaiDate, currentShift } from "@/lib/dateShift";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Download } from "lucide-react";
import ActiveRoleSwitcher from "./ActiveRoleSwitcher";

export type DashRange = "today" | "7d" | "30d";
const RANGE_LABEL: Record<DashRange, string> = { today: "วันนี้", "7d": "7 วัน", "30d": "30 วัน" };

interface Props {
  titleEn: string;
  subtitleTh: string;
  range: DashRange;
  onRangeChange: (r: DashRange) => void;
  onRefresh: () => void;
  onExport: () => void;
  roleNames?: Record<string, string>;
}

export default function DashboardHeader({
  titleEn, subtitleTh, range, onRangeChange, onRefresh, onExport, roleNames = {},
}: Props) {
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const { activeRole, setActiveRole } = useActiveRole(roles);
  const now = new Date();

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">{titleEn}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatThaiDate(now)} · <span className="font-medium text-foreground/80">{currentShift(now)}</span>
          {user?.department ? <> · แผนก {user.department}</> : null}
          {subtitleTh ? <> · {subtitleTh}</> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => onRangeChange(v as DashRange)}>
          <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABEL) as DashRange[]).map((r) => (
              <SelectItem key={r} value={r}>{RANGE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={onRefresh} aria-label="รีเฟรช">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        <ActiveRoleSwitcher roles={roles} activeRole={activeRole} onChange={setActiveRole} roleNames={roleNames} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write smoke test** — `src/components/dashboard/DashboardHeader.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActiveRoleSwitcher from "./ActiveRoleSwitcher";

describe("ActiveRoleSwitcher", () => {
  it("shows a static chip for a single role", () => {
    render(
      <MemoryRouter>
        <ActiveRoleSwitcher roles={["qc"]} activeRole="qc" onChange={vi.fn()} roleNames={{ qc: "QC Reviewer" }} />
      </MemoryRouter>,
    );
    expect(screen.getByText("QC Reviewer")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("renders a dropdown when the user holds multiple roles", () => {
    render(
      <MemoryRouter>
        <ActiveRoleSwitcher roles={["lab", "qc"]} activeRole="qc" onChange={vi.fn()} roleNames={{ lab: "Lab", qc: "QC" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/components/dashboard/DashboardHeader.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ActiveRoleSwitcher.tsx src/components/dashboard/DashboardHeader.tsx src/components/dashboard/DashboardHeader.test.tsx
git commit -m "feat(dashboard): DashboardHeader + active-role switcher"
```

---

## Task 8: `KpiRow`

**Files:**
- Create: `src/components/dashboard/KpiRow.tsx`

**Interfaces:**
- Consumes: `StatCard` (`@/components/lis/StatCard`), `KPI_META`, `KpiId` (`@/lib/dashboardProfiles`), `computeKpi`, `MetricsCtx` (`@/lib/dashboardMetrics`), `useNavigate`.
- Produces: `KpiRow({ kpis, ctx }: { kpis: KpiId[]; ctx: MetricsCtx })`.

- [ ] **Step 1: Write implementation** — `src/components/dashboard/KpiRow.tsx`

```tsx
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/lis/StatCard";
import { KPI_META, type KpiId } from "@/lib/dashboardProfiles";
import { computeKpi, type MetricsCtx } from "@/lib/dashboardMetrics";

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-muted-foreground">±0 เทียบเมื่อวาน</span>;
  const up = delta > 0;
  return (
    <span className={up ? "text-green-600" : "text-red-600"}>
      {up ? "▲" : "▼"} {Math.abs(delta)} เทียบเมื่อวาน
    </span>
  );
}

export default function KpiRow({ kpis, ctx }: { kpis: KpiId[]; ctx: MetricsCtx }) {
  const navigate = useNavigate();
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((id) => {
        const meta = KPI_META[id];
        const { value, delta } = computeKpi(id, ctx);
        return (
          <StatCard
            key={id}
            icon={meta.icon}
            value={id === "normalRateApprox" ? `${value}%` : value}
            label={meta.label}
            variant={meta.variant}
            sublabel={delta !== undefined ? <DeltaBadge delta={delta} /> : undefined}
            onClick={meta.drilldownPath ? () => navigate(meta.drilldownPath!) : undefined}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/KpiRow.tsx
git commit -m "feat(dashboard): KpiRow with delta sublabel + drill-down"
```

---

## Task 9: `ActionTable` (left 65%)

**Files:**
- Create: `src/components/dashboard/ActionTable.tsx`

**Interfaces:**
- Consumes: `Petition`, `PETITION_STATUS_CONFIG`, `PETITION_DEPT_LABELS` (`@/types/petition.types`); `ageHours` (`@/lib/dashboardMetrics`); shadcn `Table*`, `Badge`, `Button`; `useNavigate`.
- Produces: `ActionTable({ petitions, actionLabel, actionPathPrefix, urgentIds }: { petitions: Petition[]; actionLabel: string; actionPathPrefix: string; urgentIds: Set<string> })`. Columns: คำร้อง · ผู้ขอ · #ตย. · ขั้นตอน · ความสำคัญ · อายุงาน · ปุ่ม. Highlight rows where urgent or age ≥ 48h.

- [ ] **Step 1: Write implementation** — `src/components/dashboard/ActionTable.tsx`

```tsx
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PETITION_STATUS_CONFIG, PETITION_DEPT_LABELS, type Petition } from "@/types/petition.types";
import { ageHours } from "@/lib/dashboardMetrics";

const OLD_AGE_HOURS = 48;

interface Props {
  petitions: Petition[];
  actionLabel: string;
  actionPathPrefix: string;
  urgentIds: Set<string>;
}

export default function ActionTable({ petitions, actionLabel, actionPathPrefix, urgentIds }: Props) {
  const navigate = useNavigate();
  const now = Date.now();
  const firstTs = (p: Petition) => p.sampleSentAt ?? p.receivedAt ?? p.createdAt;
  const rows = [...petitions].sort((a, b) => (ageHours(firstTs(b), now) ?? 0) - (ageHours(firstTs(a), now) ?? 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">ต้องดำเนินการ</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>คำร้อง</TableHead>
                <TableHead className="hidden sm:table-cell">ผู้ขอ</TableHead>
                <TableHead className="text-center">ตย.</TableHead>
                <TableHead>ขั้นตอน</TableHead>
                <TableHead>ความสำคัญ</TableHead>
                <TableHead className="text-right">อายุงาน</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">ไม่มีรายการที่ต้องดำเนินการ</TableCell></TableRow>
              ) : rows.map((p) => {
                const age = ageHours(firstTs(p), now);
                const urgent = urgentIds.has(p._id);
                const old = (age ?? 0) >= OLD_AGE_HOURS;
                const status = PETITION_STATUS_CONFIG[p.status];
                return (
                  <TableRow
                    key={p._id}
                    className={cn("cursor-pointer", (urgent || old) && "bg-red-50/60 hover:bg-red-50")}
                    onClick={() => navigate(`${actionPathPrefix}/${p._id}`)}
                  >
                    <TableCell>
                      <div className="font-semibold text-primary">{p.petitionNo}</div>
                      <div className="text-[11px] text-muted-foreground">{PETITION_DEPT_LABELS[p.dept]}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{p.submittedBy?.name ?? "-"}</TableCell>
                    <TableCell className="text-center tabular-nums">{p.items.length}</TableCell>
                    <TableCell><Badge variant={status?.variant ?? "gray-soft"}>{status?.label}</Badge></TableCell>
                    <TableCell>
                      {urgent
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> ด่วน</span>
                        : <span className="text-xs text-muted-foreground">ปกติ</span>}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", old && "font-semibold text-red-600")}>
                      {age === null ? "—" : `${age} ชม.`}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-8 w-full"
                        onClick={(e) => { e.stopPropagation(); navigate(`${actionPathPrefix}/${p._id}`); }}>
                        {actionLabel}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
```bash
git add src/components/dashboard/ActionTable.tsx
git commit -m "feat(dashboard): ActionTable with age column + urgent/overdue highlight"
```

---

## Task 10: `WorkflowSummary` (right 35% — donut + pipeline)

**Files:**
- Create: `src/components/dashboard/WorkflowSummary.tsx`

**Interfaces:**
- Consumes: recharts (`PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid`), `ChartContainer, ChartTooltip, ChartTooltipContent` (`@/components/ui/chart`), `statusDonutData`, `pipelineStages` (`@/lib/dashboardMetrics`), `WorkflowKind` (`@/lib/dashboardProfiles`), `Card*`.
- Produces: `WorkflowSummary({ kind, petitions }: { kind: WorkflowKind; petitions: Petition[] })`.

- [ ] **Step 1: Write implementation** — `src/components/dashboard/WorkflowSummary.tsx`

```tsx
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusDonutData, pipelineStages } from "@/lib/dashboardMetrics";
import type { WorkflowKind } from "@/lib/dashboardProfiles";
import type { Petition } from "@/types/petition.types";

export default function WorkflowSummary({ kind, petitions }: { kind: WorkflowKind; petitions: Petition[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">สรุป Workflow</CardTitle></CardHeader>
      <CardContent>
        {kind === "statusDonut" ? <StatusDonut petitions={petitions} /> : <PipelineBar petitions={petitions} />}
      </CardContent>
    </Card>
  );
}

function StatusDonut({ petitions }: { petitions: Petition[] }) {
  const data = statusDonutData(petitions);
  if (data.length === 0) return <Empty />;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={58} outerRadius={85} paddingAngle={2}>
            {data.map((d) => <Cell key={d.key} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{total}</span>
        <span className="text-xs text-muted-foreground">คำขอ</span>
      </div>
      <ul className="mt-3 space-y-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate">{d.label}</span>
            <span className="tabular-nums font-medium">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PipelineBar({ petitions }: { petitions: Petition[] }) {
  const data = pipelineStages(petitions);
  if (data.every((d) => d.count === 0)) return <Empty />;
  return (
    <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={72} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function Empty() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>;
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
```bash
git add src/components/dashboard/WorkflowSummary.tsx
git commit -m "feat(dashboard): WorkflowSummary donut + pipeline (recharts)"
```

---

## Task 11: `AnalyticsSection`

**Files:**
- Create: `src/components/dashboard/AnalyticsSection.tsx`

**Interfaces:**
- Consumes: recharts + `ui/chart`, `ChartSpec` (`@/lib/dashboardProfiles`), `deptWorkloadData`, `analystWorkloadData`, `normalDonutData`, `requestTrendData`, `statusDonutData` (`@/lib/dashboardMetrics`), `MetricsCtx`, `Card*`.
- Produces: `AnalyticsSection({ specs, ctx }: { specs: ChartSpec[]; ctx: MetricsCtx })`. Renders nothing (null) when `specs` empty.

- [ ] **Step 1: Write implementation** — `src/components/dashboard/AnalyticsSection.tsx`

```tsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartSpec } from "@/lib/dashboardProfiles";
import {
  deptWorkloadData, analystWorkloadData, normalDonutData, requestTrendData, statusDonutData,
  type MetricsCtx,
} from "@/lib/dashboardMetrics";

export default function AnalyticsSection({ specs, ctx }: { specs: ChartSpec[]; ctx: MetricsCtx }) {
  if (specs.length === 0) return null;
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {specs.map((s) => (
        <Card key={s.kind + s.title}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
          <CardContent><ChartFor spec={s} ctx={ctx} /></CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartFor({ spec, ctx }: { spec: ChartSpec; ctx: MetricsCtx }) {
  if (spec.kind === "deptBar") return <SimpleBar data={ctx ? deptWorkloadData(ctx.petitions).map((d) => ({ name: d.label, count: d.count })) : []} />;
  if (spec.kind === "analystBar") return <SimpleBar data={analystWorkloadData(ctx.petitions).map((d) => ({ name: d.name, count: d.count }))} />;
  if (spec.kind === "withdrawBar") return <TrendBar data={requestTrendData(ctx.petitions, ctx.now, 7)} note="(ใช้ createdAt คำขอเป็นตัวแทนช่วง — การเบิกจริงดูหน้าเบิก)" />;
  if (spec.kind === "requestTrend") return <TrendBar data={requestTrendData(ctx.petitions, ctx.now, 14)} />;
  if (spec.kind === "normalDonut") return <Donut data={normalDonutData(ctx.petitions, ctx.abnormalFlags)} />;
  return <Donut data={statusDonutData(ctx.petitions)} />; // statusDonut
}

function SimpleBar({ data }: { data: { name: string; count: number }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function TrendBar({ data, note }: { data: { date: string; count: number }[]; note?: string }) {
  if (data.every((d) => d.count === 0)) return <Empty />;
  return (
    <>
      <ChartContainer config={{ count: { label: "จำนวน", color: "hsl(var(--primary))" } }} className="h-[200px] w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>
      {note ? <p className="mt-1 text-[10px] text-muted-foreground">{note}</p> : null}
    </>
  );
}

function Donut({ data }: { data: { key: string; label: string; value: number; color: string }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">ไม่มีข้อมูล</div>;
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
```bash
git add src/components/dashboard/AnalyticsSection.tsx
git commit -m "feat(dashboard): AnalyticsSection role-specific charts (real data)"
```

---

## Task 12: `ActivityTimeline`

**Files:**
- Create: `src/components/dashboard/ActivityTimeline.tsx`

**Interfaces:**
- Consumes: `usePetitionAuditLogList` (`@/hooks/usePetition`), `PetitionAuditLogEntry`, `PETITION_STATUS_CONFIG` (`@/types/petition.types`), `Card*`, lucide icons.
- Produces: `ActivityTimeline({ kind }: { kind: "audit" | "statusChanges" })`. Both use `usePetitionAuditLogList`; `statusChanges` filters `event === "statusChanged"`. Shows latest ~8.

- [ ] **Step 1: Write implementation** — `src/components/dashboard/ActivityTimeline.tsx`

```tsx
import { usePetitionAuditLogList } from "@/hooks/usePetition";
import { PETITION_STATUS_CONFIG, type PetitionAuditLogEntry } from "@/types/petition.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

const EVENT_LABEL: Record<string, string> = {
  created: "สร้างคำร้อง", statusChanged: "เปลี่ยนสถานะ", assigned: "มอบหมาย",
  reviewed: "ตรวจทาน", updated: "แก้ไข", deleted: "ลบ", received: "รับตัวอย่าง",
  resultEntered: "บันทึกผล", resultUpdated: "แก้ไขผล",
};

function describe(e: PetitionAuditLogEntry): string {
  const base = EVENT_LABEL[e.event] ?? e.event;
  if (e.event === "statusChanged" && e.toStatus) {
    return `${base} → ${PETITION_STATUS_CONFIG[e.toStatus]?.label ?? e.toStatus}`;
  }
  return base;
}

export default function ActivityTimeline({ kind }: { kind: "audit" | "statusChanges" }) {
  const { data } = usePetitionAuditLogList({ page: 1, limit: 20 });
  let items = data?.items ?? [];
  if (kind === "statusChanges") items = items.filter((e) => e.event === "statusChanged");
  items = items.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" /> กิจกรรมล่าสุด
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีกิจกรรม</p>
        ) : (
          <ol className="relative space-y-3 pl-4">
            {items.map((e) => (
              <li key={e._id} className="relative">
                <span className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-primary/60" />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm"><span className="font-medium text-primary">{e.petitionNo}</span> · {describe(e)}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {new Date(e.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {e.actor ? <p className="text-[11px] text-muted-foreground">โดย {e.actor}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
```bash
git add src/components/dashboard/ActivityTimeline.tsx
git commit -m "feat(dashboard): ActivityTimeline from petition audit log"
```

---

## Task 13: `RoleDashboard` page (compose all)

**Files:**
- Create: `src/pages/RoleDashboard.tsx`

**Interfaces:**
- Consumes: `AppLayout`, all `@/components/dashboard/*`, `useDashboardData`, `useAuth`, `useActiveRole`, `normalizeRoles`, `resolveProfileForRole`, `DASHBOARD_PROFILES`, `loadAccessControl` via `useQuery`, `useState`.
- Produces: default-export `RoleDashboard` — resolves active role → profile, fetches data, lays out header + KPI + 65/35 workspace + analytics + activity. Owns `<AppLayout>`.

- [ ] **Step 1: Write implementation** — `src/pages/RoleDashboard.tsx`

```tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/lis/AppLayout";
import DashboardHeader, { type DashRange } from "@/components/dashboard/DashboardHeader";
import KpiRow from "@/components/dashboard/KpiRow";
import ActionTable from "@/components/dashboard/ActionTable";
import WorkflowSummary from "@/components/dashboard/WorkflowSummary";
import AnalyticsSection from "@/components/dashboard/AnalyticsSection";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import { useAuth } from "@/context/AuthContext";
import { useActiveRole } from "@/store/activeRole";
import { normalizeRoles } from "@/lib/roles";
import { resolveProfileForRole, DASHBOARD_PROFILES } from "@/lib/dashboardProfiles";
import { useDashboardData } from "@/hooks/useDashboardData";
import { loadAccessControl } from "@/lib/accessControlSource";

const ACTION_LABEL: Record<string, string> = {
  "qc-reviewer": "อนุมัติผล", "qc-head": "อนุมัติ", "qc-staff": "ดำเนินการ",
  "lab-analyze": "บันทึกผล", "lab-head": "อนุมัติ", "lab-config": "ดูรายละเอียด",
  "lab-inventory": "จัดการ", admin: "ดูรายละเอียด", viewer: "ดูรายละเอียด",
};

export default function RoleDashboard() {
  const { user } = useAuth();
  const roles = normalizeRoles(user);
  const { activeRole } = useActiveRole(roles);
  const [range, setRange] = useState<DashRange>("today");

  const { data: access } = useQuery({ queryKey: ["access-control"], queryFn: loadAccessControl });
  const roleObjs = access?.roles ?? [];
  const roleNames = useMemo(
    () => Object.fromEntries(roleObjs.map((r: { id: string; name: string }) => [r.id, r.name])),
    [roleObjs],
  );

  const profileId = resolveProfileForRole(activeRole, roleObjs);
  const profile = DASHBOARD_PROFILES[profileId];
  const { petitions, ctx, refresh } = useDashboardData(profile);

  const urgentIds = useMemo(
    () => new Set(petitions.filter((p) => ctx.abnormalFlags[p._id] || ctx.returnedFlags[p._id]).map((p) => p._id)),
    [petitions, ctx.abnormalFlags, ctx.returnedFlags],
  );

  const handleExport = () => {
    const header = ["คำร้อง", "ผู้ขอ", "ตัวอย่าง", "สถานะ"];
    const lines = petitions.map((p) => [p.petitionNo, p.submittedBy?.name ?? "", p.items.length, p.status].join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `dashboard-${profileId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <DashboardHeader
        titleEn={profile.titleEn}
        subtitleTh={profile.subtitleTh}
        range={range}
        onRangeChange={setRange}
        onRefresh={refresh}
        onExport={handleExport}
        roleNames={roleNames}
      />
      <KpiRow kpis={profile.kpis} ctx={ctx} />
      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,65fr)_35fr]">
        <ActionTable
          petitions={petitions}
          actionLabel={ACTION_LABEL[profileId] ?? "ดูรายละเอียด"}
          actionPathPrefix="/petitions"
          urgentIds={urgentIds}
        />
        {profile.workflow ? <WorkflowSummary kind={profile.workflow} petitions={petitions} /> : <div />}
      </div>
      <AnalyticsSection specs={profile.analytics} ctx={ctx} />
      <ActivityTimeline kind={profile.activity} />
    </AppLayout>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors. (If `loadAccessControl` return type lacks `roles`/`users`, read `src/lib/accessControlSource.ts` and adjust field access.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/RoleDashboard.tsx
git commit -m "feat(dashboard): RoleDashboard composes profile-driven layout"
```

---

## Task 14: Route consolidation — `Home` renders RoleDashboard, redirect `/dashboard/*`

**Files:**
- Modify: `src/pages/Home.tsx` (replace whole file), `src/App.tsx` (routes for `/dashboard/lab`, `/dashboard/qc`)

**Interfaces:**
- Consumes: `RoleDashboard`, `Navigate` (`react-router-dom`).

- [ ] **Step 1: Replace `src/pages/Home.tsx`** with:

```tsx
import RoleDashboard from "@/pages/RoleDashboard";

const Home = () => <RoleDashboard />;

export default Home;
```

- [ ] **Step 2: Redirect the old dashboard routes** — in `src/App.tsx`, find the `<Route path="/dashboard/lab" ...>` and `<Route path="/dashboard/qc" ...>` entries (they lazy-render `LabDashboard`/`QCDashboard`) and replace their `element` with a redirect. Add `import { Navigate } from "react-router-dom";` if absent. Keep them inside `<PrivateRoute>` as before:

```tsx
<Route path="/dashboard/lab" element={<PrivateRoute><Navigate to="/home" replace /></PrivateRoute>} />
<Route path="/dashboard/qc" element={<PrivateRoute><Navigate to="/home" replace /></PrivateRoute>} />
```

Remove the now-unused `LabDashboard`/`QCDashboard` lazy imports from `App.tsx` (they are deleted in Task 16 — removing the import now prevents a build error).

- [ ] **Step 3: Type-check + manual smoke**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
Manual: `npm run dev` (frontend) + `cd server && npm run dev` (backend). Open `/home` — dashboard renders for the dev user; visiting `/dashboard/qc` redirects to `/home`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx src/App.tsx
git commit -m "feat(dashboard): /home renders RoleDashboard, redirect /dashboard/{lab,qc}"
```

---

## Task 15: Sidebar — active-role scoping + `/` → `/home`

**Files:**
- Modify: `src/components/lis/AppSidebar.tsx` (`effectiveUser` at :71-80, `"/"` redirect at :311-322)

**Interfaces:**
- Consumes: `useActiveRole` (`@/store/activeRole`).

> View-filter only — `PrivateRoute`/`userCanAccessPath` elsewhere still use the union, so switching active role never revokes real access; admin short-circuits (sees all).

- [ ] **Step 1: Scope `effectiveUser` to the active role** — `src/components/lis/AppSidebar.tsx`. Add near the other hooks: `const { activeRole } = useActiveRole(normalizeRoles(user));` (import `useActiveRole` from `@/store/activeRole`). Then change the `effectiveUser` memo (:71-80) to scope permissions to the active role only:

```tsx
  const effectiveUser = useMemo(
    () =>
      user
        ? {
            ...user,
            roles: [activeRole],
            permissions: unionPermissions([activeRole], accessControl?.permissions ?? {}),
          }
        : user,
    [user, activeRole, accessControl?.permissions],
  );
```

- [ ] **Step 2: Point the `"/"` nav item at `/home`** — replace the `targetPath` block (:311-320) with:

```tsx
                {visibleItems.map((item) => {
                  const targetPath = item.path === "/" ? "/home" : item.path;
                  const isActive =
                    item.path === activePath ||
                    (item.path === "/" && (location.pathname === "/home" || location.pathname.startsWith("/dashboard/")));
```

- [ ] **Step 3: Type-check + manual smoke**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
Manual (dev): use DevRoleSwitcher to give the dev user two roles (e.g. `lab` + `qc`); the header active-role dropdown appears; switching it changes the dashboard title/KPIs AND filters the sidebar to that role's menu; switching back restores. Admin still sees all menu items.

- [ ] **Step 4: Commit**

```bash
git add src/components/lis/AppSidebar.tsx
git commit -m "feat(dashboard): sidebar scopes nav to active role (view filter) + / → /home"
```

---

## Task 16: Settings — role→profile mapping control

**Files:**
- Modify: `src/components/lis/DashboardLayoutConfigCard.tsx`

**Interfaces:**
- Consumes: `DASHBOARD_PROFILE_IDS`, `DASHBOARD_PROFILES` (`@/lib/dashboardProfiles`), `api.patch`, `loadAccessControl` via `useQuery`, shadcn `Select`.
- Produces: within the existing card, a "Dashboard profile ต่อ Role" table: each role → `<Select>` of the 9 profile ids (+ "ค่าเริ่มต้น" = unset). On change: `api.patch(\`/access-control/roles/\${roleId}\`, { dashboardProfile })` then invalidate `["access-control"]`.

- [ ] **Step 1: Add the mapping section.** Read the current `DashboardLayoutConfigCard.tsx` to match its layout/query patterns, then add a section that:
  1. `const qc = useQueryClient();`
  2. `const { data: access } = useQuery({ queryKey: ["access-control"], queryFn: loadAccessControl });`
  3. Renders one row per `access?.roles`:

```tsx
{(access?.roles ?? []).map((role: { id: string; name: string; dashboardProfile?: string | null }) => (
  <div key={role.id} className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-sm">{role.name} <span className="text-xs text-muted-foreground">({role.id})</span></span>
    <Select
      value={role.dashboardProfile ?? "_default"}
      onValueChange={async (v) => {
        await api.patch(`/access-control/roles/${role.id}`, { dashboardProfile: v === "_default" ? "" : v });
        qc.invalidateQueries({ queryKey: ["access-control"] });
      }}
    >
      <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="_default">ค่าเริ่มต้น (ตาม role)</SelectItem>
        {DASHBOARD_PROFILE_IDS.map((id) => (
          <SelectItem key={id} value={id}>{DASHBOARD_PROFILES[id].titleEn}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
))}
```

- [ ] **Step 2: Type-check + manual smoke**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no new errors
Manual: Settings → change a role's dashboard profile → reload `/home` as that role → the mapped profile renders. Confirm the `PATCH` hit the server (Network tab) and `formatRole` returns the new `dashboardProfile`.

- [ ] **Step 3: Commit**

```bash
git add src/components/lis/DashboardLayoutConfigCard.tsx
git commit -m "feat(dashboard): Settings maps role → dashboard profile (PATCH /roles/:id)"
```

---

## Task 17: Cleanup — remove old dashboards

**Files:**
- Delete: `src/components/home/HomeAdmin.tsx`, `HomeLab.tsx`, `HomeQC.tsx`, `HomeViewer.tsx`, `HomeGeneric.tsx`, `src/pages/LabDashboard.tsx`, `src/pages/QCDashboard.tsx`
- Possibly modify: any remaining importer surfaced by type-check

**Interfaces:** none produced.

- [ ] **Step 1: Find remaining references**

Run: `git grep -nE "HomeAdmin|HomeLab|HomeQC|HomeViewer|HomeGeneric|LabDashboard|QCDashboard" -- src`
Expected: only `App.tsx` lazy imports (already removed in Task 14) and the files themselves. If any other importer appears, update it to `RoleDashboard`/remove.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/home/HomeAdmin.tsx src/components/home/HomeLab.tsx src/components/home/HomeQC.tsx src/components/home/HomeViewer.tsx src/components/home/HomeGeneric.tsx src/pages/LabDashboard.tsx src/pages/QCDashboard.tsx
```

(Keep `src/components/home/HomeHeader.tsx` — still exported/used elsewhere; verify with `git grep -n HomeHeader -- src`. If it has zero importers after deletion, delete it too.)

- [ ] **Step 3: Full verification**

Run: `npx tsc -p tsconfig.app.json --noEmit` → Expected: no errors
Run: `npm run lint` → Expected: no new errors
Run: `npx vitest run` → Expected: all suites pass (incl. new dashboard tests)
Run: `node --test server/lib/dashboardProfiles.test.js` → Expected: PASS

- [ ] **Step 4: Manual E2E (browser, per project convention)**

`npm run dev` + backend. For each of ≥3 profiles (via DevRoleSwitcher / Settings mapping): verify header title (English role) + Thai date/shift, KPI cards show real counts + drill-down navigates, ActionTable highlights old/urgent rows, WorkflowSummary donut/pipeline renders, AnalyticsSection charts render (or show "ไม่มีข้อมูล"), ActivityTimeline lists recent audit entries, multi-role switch changes dashboard + sidebar, Export downloads a CSV. Confirm no horizontal scroll at 1920px and layout holds at a narrow width.

- [ ] **Step 5: Commit**

```bash
git add -A -- src/components/home src/pages
git commit -m "chore(dashboard): remove legacy Home*/LabDashboard/QCDashboard"
```

---

## Self-Review (against spec)

**Spec coverage:**
- §1 architecture/files → Tasks 2–13, 17 ✓
- §2 profile model + role→profile + default map → Task 2 (client) + Task 1 (server field) ✓
- §3 header + active-role switcher + shift/date → Tasks 3, 5, 7 ✓
- §4 layout (KPI / 65-35 / analytics / activity, semantic color, age-not-duedate) → Tasks 8–13 ✓
- §5 per-profile real-data content → Task 2 registry + Task 4 compute ✓
- §6 routing consolidation → Task 14 ✓
- §7 role→profile Settings surface → Task 16 ✓
- §8 data layer + window caveat → Task 6 (comment + limit 200) ✓
- §9 testing (resolution, compute, date/shift, active-role, header smoke) → Tasks 1–5, 7 ✓
- §10 out-of-scope respected (no User/Role UI, no backend aggregate, delta only where prior exists) ✓
- Decision #5 (sidebar view-filter) → Task 15 ✓ · #6 (age col) → Task 9 ✓ · #7 (redirect) → Task 14 ✓

**Placeholder scan:** no "TBD/implement later"; the two `// TODO verify` notes (Task 6) are explicit real-integration verification points with a concrete non-fabricated interim, per the "real data only" constraint — not code placeholders.

**Type consistency:** `MetricsCtx`/`KpiValue` defined in Task 4, consumed unchanged in Tasks 6/8/13. `KpiId`/`DashboardProfile`/`resolveProfileForRole`/`resolveActiveRole` defined Task 2, consumed Tasks 4/5/6/13. `StatVariant` union matches `StatCard`'s `variant` (Task 2 note). `DashRange` defined Task 7, consumed Task 13. `useActiveRole(roleIds)` signature consistent Tasks 5/7/13/15. `formatRole().dashboardProfile` (Task 1) consumed by `resolveProfileForRole` (Task 2) and Settings (Task 16).
