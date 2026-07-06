# Role-based Dashboard Redesign

วันที่: 2026-07-06
Branch: develop
Status: อนุมัติดีไซน์แล้ว — รอเขียน implementation plan
ไฟล์หลัก (ใหม่): `src/lib/dashboardProfiles.ts`, `src/pages/RoleDashboard.tsx`, `src/components/dashboard/*`

> ขอบเขต spec นี้ = **A) redesign แดชบอร์ด role-based** เท่านั้น
> การ redesign หน้าจัดการ **User & Role (AccessControl)** แยกเป็น **spec B** (คนละรอบ)

## เป้าหมาย

แดชบอร์ดปัจจุบันดูกระจัดกระจายเหมือนหลาย section ที่ไม่เกี่ยวกัน. Redesign ให้:
- มี **visual hierarchy ชัด** (แยกออกทันทีว่าอะไรคือ KPI / งานที่ต้องทำ / สรุป / กิจกรรม)
- **เปลี่ยนเนื้อหาแบบ dynamic ตาม active role** ของผู้ใช้ (role-based dashboard system)
- คงสไตล์เดิม: ขาว/เทาอ่อน, primary น้ำเงิน, การ์ดมุมมน, เส้นขอบบาง, UI แน่นแบบ enterprise
- Label หลักเป็นภาษาไทย, ใช้อังกฤษเฉพาะชื่อ role เชิงเทคนิค
- ออกแบบสำหรับจอ desktop 1920px (high-density แต่อ่านง่าย) + responsive จอเล็ก

## บริบทที่เกี่ยวข้อง (ของเดิม)

- **Role เป็นข้อมูลใน DB ไม่ใช่โค้ด** (`server/models/Role.js`, seed ที่ `server/seed-access-control.js`). ปัจจุบัน seed จริงแค่ 4 role: `admin` (Administrator, locked, bypass ทุก check), `lab` (Lab Analyst), `qc` (QC Reviewer), `viewer`. admin สร้าง custom role ได้ตอน runtime
- **Multi-role**: user ถือ `roles: string[]` (legacy `role` เดี่ยว ถูก lazy-migrate ผ่าน `normalizeRoles()`). `src/lib/roles.ts` (mirror `server/lib/roles.js`): `primaryRole()` = role อันดับสูงสุด (admin>qc>lab>custom>viewer), `unionPermissions()` = union สิทธิ์ทุก role. **ยังไม่มี active-role switcher ในโปรดักชัน** — ปัจจุบันใช้ union + primaryRole อัตโนมัติ
- **DevRoleSwitcher** (`src/components/DevRoleSwitcher.tsx`, dev-only ตาม `DEV_MODE`): widget ลอยมุมล่างขวา toggle role แบบ multi-select เก็บ `localStorage["dev_roles"]`, wire ผ่าน `AuthContext` (`devRoleIds`, `toggleDevRole`)
- **มีระบบแดชบอร์ด 2 ชุดซ้อนกัน**:
  - `/home` (`src/pages/Home.tsx`, 118 บรรทัด) — dispatcher: `resolveHomeKind(primaryRole, unionPermissions, groups)` → `admin|qc|lab|viewer|generic` แล้ว render `HomeAdmin/HomeLab/HomeQC/HomeViewer/HomeGeneric` (`src/components/home/`) ใน `<AppLayout>`. แต่ละตัวเป็น StatCard + hero + list (ไม่มี chart)
  - `/dashboard/lab`, `/dashboard/qc` (`src/pages/LabDashboard.tsx` 310, `QCDashboard.tsx` 299) — config-driven ผ่าน `useDashboardLayout("lab"|"qc")` + `src/lib/dashboardLayout.ts` (`SectionId`, `KpiId`, `defaultLayout`, `resolveLayoutForRoles`) + แก้ config ใน Settings ผ่าน `DashboardLayoutConfigCard.tsx` + `DashboardLayoutPreview`
  - sidebar "/" redirect → `/dashboard/{qc|lab}` ตาม primary role; แต่ `/` และ `/home` route render `Home`. **สองระบบ live พร้อมกัน**
- **Header เดิม**: `src/components/home/HomeHeader.tsx` (greeting ตามชั่วโมง + วันที่ไทย + กะเช้า/กะบ่าย). LabDashboard/QCDashboard มี inline header (วันที่+กะ+search+export) อีกแบบ. global topbar `AppLayout.tsx:98-100` (h-12) ตอนนี้มีแค่ `NotificationBell`
- **Primitives พร้อม reuse**: `StatCard.tsx` (variants blue/amber/green/red/neutral, มี `active`+`onClick`), `PetitionDashboardTable.tsx`, `WaitingSamplesCard.tsx`, `PendingQcSamplesCard.tsx`
- **Charts**: `recharts` มีใน package.json + `src/components/ui/chart.tsx` (shadcn wrapper: `ChartContainer/ChartTooltip/ChartLegend`). ใช้จริงแค่ `Report.tsx`, `VirtualLabPage.tsx`. **แดชบอร์ด/Home ยังไม่ใช้ chart เลย**
- **Data hooks/endpoints ที่ดึงได้จริง**: `usePetitionList({page,limit})` (`src/hooks/usePetition.ts`, ดึง client-side ~100 ราย, filter สถานะเอง), `api.getQCProgress/getAbnormalFlags/getReturnedFlags(ids)`, `useSamples()` (doneSamples/approvals/physicalSamples/sentSamples/realtimeDensities), `api.getDailyCheckTodaySummary/getEnvCheckTodaySummary/getDailyChecks/getEquipmentChecks`, `api.getStandards/getSolvents/getGlassware/getStockTransactions/getStockUnits`, `api.getStandardTimeSummary`, `api.getResultDensities`, `loadAccessControl()` (`{groups,permissions,roles}` + user list ใน AccessControl), audit log ผ่าน `PetitionAuditLogPage` endpoint. React Query default poll 10s

## การตัดสินใจ (ยืนยันกับผู้ใช้)

1. **แยก 2 spec — ทำแดชบอร์ดก่อน** (spec นี้). User/Role management = spec B
2. **แยก dashboard profile ออกจาก role** — ไม่บังคับสร้าง 9 role. ทำ `DashboardProfile` registry 9 ตัว แยกจาก role แล้ว map role→profile (default พร้อมใช้ + admin ปรับได้)
3. **ข้อมูลจริงเท่านั้น** — KPI/chart ที่ไม่มีแหล่งข้อมูล → **ตัดออก** (ไม่ mock ไม่ placeholder หลอกตา). ยอมรับว่าบาง profile (เช่น Lab Data Config) จะ widget น้อย
4. **สถาปัตยกรรม = Approach 1 (config-driven registry)** — ต่อยอด `dashboardLayout.ts`, RoleDashboard renderer เดียว, รวบ 2 ระบบเป็นทางเดียว
5. **สลับ active role → กรอง sidebar ด้วย** — เป็น *view filter* เท่านั้น ไม่ตัดสิทธิ์จริง (PrivateRoute ยังใช้ union), สลับกลับได้เสมอ, admin เห็นครบ
6. **แทนคอลัมน์ "due date" ด้วย "อายุงาน (age)"** — เพราะระบบไม่มี due date จริง (คำนวณจาก timestamp จริงแทน)
7. **รวบ `/dashboard/{lab,qc}` → redirect `/home`** — เหลือ dashboard ทางเดียว

## ดีไซน์

### §1 สถาปัตยกรรม & ไฟล์

เหลือ dashboard **code path เดียว**: `RoleDashboard` ที่ render ตาม `DashboardProfile` ซึ่ง resolve จาก active role

| ไฟล์ | สถานะ | บทบาท |
|---|---|---|
| `src/lib/dashboardProfiles.ts` | ใหม่ | registry 9 profile (typed, ในโค้ด) + `resolveProfileForRole()` + `resolveActiveRole()`. ดูด concept จาก `dashboardLayout.ts` |
| `src/lib/dashboardProfiles.test.ts` | ใหม่ | test resolution + default map + multi-role |
| `src/pages/RoleDashboard.tsx` | ใหม่ | renderer เดียว (แทน Home*+*Dashboard). อ่าน active role → profile → วาง section |
| `src/hooks/useActiveRole.ts` | ใหม่ | active role state (`localStorage["lis.activeRole"]`, default `primaryRole`) + setter; ให้ sidebar/หน้าอื่นใช้ร่วม |
| `src/hooks/useDashboardData.ts` | ใหม่ | ดึง+คำนวณเฉพาะแหล่งที่ profile ต้องใช้ (reuse hook เดิม), memoize KPI/chart datasets |
| `src/components/dashboard/DashboardHeader.tsx` | ใหม่ | title/date/shift/dept/date-filter/refresh/export/active-role switcher |
| `src/components/dashboard/KpiRow.tsx` | ใหม่ | 4–6 StatCard (reuse `StatCard` + delta ถ้ามี prior จริง) |
| `src/components/dashboard/ActionTable.tsx` | ใหม่ | ต่อยอด `PetitionDashboardTable` (ซ้าย 65%) |
| `src/components/dashboard/WorkflowSummary.tsx` | ใหม่ | donut/บาร์ สรุป workflow (ขวา 35%) |
| `src/components/dashboard/AnalyticsSection.tsx` | ใหม่ | chart ต่อ profile (recharts + `ui/chart`) |
| `src/components/dashboard/ActivityTimeline.tsx` | ใหม่ | timeline กิจกรรมล่าสุด |
| `src/pages/Home.tsx` | แก้ | render `<RoleDashboard>` (dispatcher เดิมถูกแทน) |
| `src/pages/LabDashboard.tsx`, `QCDashboard.tsx` | ลบ/redirect | route → `/home` |
| `src/components/home/HomeAdmin/HomeLab/HomeQC/HomeViewer/HomeGeneric.tsx` | ลบ | แทนด้วย RoleDashboard + profiles (ย้าย widget ที่ reuse ได้เข้ามาก่อนลบ) |
| `src/components/lis/AppSidebar.tsx` | แก้ | กรอง nav ตาม active role (view filter) + "/" → `/home` |
| `src/components/lis/DashboardLayoutConfigCard.tsx` | แก้ | เพิ่ม map role → dashboard profile (surface ขั้นต่ำ) |
| `server/models/Role.js` | แก้ | เพิ่ม field `dashboardProfile?: string` (optional) |
| `server/routes/access-control.js` | แก้ | รับ/คืน `dashboardProfile` บน role |

### §2 Profile model & role→profile resolution

```ts
type DashboardProfileId =
  | "admin" | "lab-analyze" | "lab-config" | "lab-head" | "lab-inventory"
  | "qc-staff" | "qc-reviewer" | "qc-head" | "viewer";

interface DashboardProfile {
  id: DashboardProfileId;
  titleEn: string;        // "QC Reviewer Dashboard" (ชื่อ role อังกฤษ)
  subtitleTh: string;     // คำอธิบายไทยสั้น
  kpis: KpiSpec[];        // 4–6 ตัว (เฉพาะที่มีข้อมูลจริง)
  actionTable: ActionTableSpec;   // คอลัมน์ + ปุ่ม action + ตัวกรองงานที่ต้องทำ
  workflow: WorkflowSpec;         // donut | pipeline
  analytics: ChartSpec[];         // 1–2 chart (real data)
  activity: ActivitySpec;         // audit | statusChanges
}
```

- เพิ่ม `dashboardProfile?` บน **Role**. ถ้าไม่ตั้ง → `resolveProfileForRole(role)` ใช้ **default map**:
  `admin→admin`, `qc→qc-reviewer`, `lab→lab-analyze`, `viewer→viewer`, custom อื่น→`viewer` (generic)
- **decoupled จริง**: admin ชี้ role ใดก็ได้ → profile ใดก็ได้ (แก้ใน Settings §7). ออกกล่องเห็น 4/9 profile; อีก 5 profile build ครบพร้อมใช้เมื่อ role ถูก assign/สร้าง (spec B)
- `resolveActiveRole(roles, stored)`: ถ้า `stored` อยู่ใน `roles` ใช้เลย ไม่งั้น `primaryRole(roles)`

### §3 Active-role switcher & DashboardHeader

- **Title** = `profile.titleEn` (อังกฤษ เช่น "QC Reviewer Dashboard"), subtitle/label อื่นเป็นไทย
- Header ประกอบด้วย: วันที่ไทย · **กะ** (เช้า/บ่าย, reuse logic จาก `HomeHeader`) · แผนก (จาก user) · **date-filter** (วันนี้/7วัน/30วัน — scope หน้าต่างที่คำนวณ client) · **refresh** (React Query refetch) · **export** (CSV/print ตาราง action ปัจจุบัน) · **active-role dropdown**
- dropdown แสดงเฉพาะ user ที่มี **>1 role** (role เดียว = chip นิ่ง). เลือกแล้วเก็บ `localStorage["lis.activeRole"]` ผ่าน `useActiveRole`
- สลับ active role → (ก) เปลี่ยน `profile` แดชบอร์ด (ข) **กรอง sidebar** ให้เหลือเมนูของ role นั้น (view filter ผ่าน permissions ของ role เดียว) — **ไม่ตัดสิทธิ์จริง**: `PrivateRoute`/`userCanAccessPath` ยังใช้ union สลับ role กลับได้เสมอ, admin เห็นครบ
- **DevRoleSwitcher**: คงเป็น dev-only (ไม่โผล่ในโปรดักชันอยู่แล้ว) แต่เอา "ปุ่ม role ลอยล่าง" ออกจาก flow โปรดักชันตามโจทย์ — โปรดักชันสลับ role ที่ **header dropdown** เท่านั้น. ใน dev ให้ DevRoleSwitcher กับ header switcher sync ผ่าน state เดียวกันได้ (nice-to-have)

### §4 Layout (สไตล์เดิม: ขาว/เทาอ่อน, primary น้ำเงิน, การ์ดมน, เส้นบาง, compact; grid สำหรับ 1920px + responsive)

```
┌────────────────────────────────────────────────────────────────────────┐
│ QC Reviewer Dashboard        [วันนี้▼][⟳][⭳ export]   [👤 QC Reviewer ▼] │  §3 header
│ จ. 6 ก.ค. 69 · กะเช้า · แผนก QC                                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ รอ review│ out-spec │ ตีกลับ   │ อนุมัติ  │  …4–6    │  ← KpiRow §5      │  semantic:
│   12  ▲2 │   3  🔴  │   1      │  8 วันนี้ │          │                  │  น้ำเงิน=กำลังทำ
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┤  เหลือง=รอ
│  ต้องดำเนินการ (65%)                    │ Workflow สรุป (35%)            │  แดง=เกิน/ผิดปกติ
│  เลขที่·ผู้ขอ·#ตย.·ขั้นตอน·             │      ╭───╮  donut สถานะ        │  เขียว=เสร็จ
│  ความสำคัญ·อายุงาน·[ปุ่ม action]        │      ╰───╯                     │
│  🔴 แถวเกิน/urgent ไฮไลต์ชัด            │   ▓▓▓▓░░ pipeline บาร์         │
├────────────────────────────────────────┴───────────────────────────────┤
│  Analytics (§5 ต่อ profile): donut ปกติ/ผิดปกติ · บาร์ งานต่อแผนก ...    │
├──────────────────────────────────────────────────────────────────────────┤
│  กิจกรรมล่าสุด (timeline: audit / status changes)                        │
└──────────────────────────────────────────────────────────────────────────┘
```

- **KpiRow**: 4–6 StatCard. แต่ละใบ = icon + label(ไทย) + ค่ารวม + **delta ▲▼% (แสดงเฉพาะที่คำนวณ prior จริงได้** เช่น วันนี้ vs เมื่อวาน จาก timestamp; ตัวที่เทียบไม่ได้ → ซ่อน delta) + click drill-down (navigate ไป list ที่ filter แล้ว). สีตาม semantic state
- **ActionTable (ซ้าย 65%)**: ต่อยอด `PetitionDashboardTable` — คอลัมน์: เลขคำร้อง · ผู้ขอ · จำนวนตัวอย่าง · ขั้นตอนปัจจุบัน · **ความสำคัญ** (=flag/urgent จาก `getAbnormalFlags`/`getReturnedFlags`) · **อายุงาน** (แทน due date, คำนวณจาก timestamp จริง) · ปุ่ม action ตาม profile. ไฮไลต์แถวอายุมาก/urgent ชัดเจน
- **WorkflowSummary (ขวา 35%)**: donut สถานะ หรือ pipeline บาร์ (profile เลือก) — recharts + `ui/chart`

### §5 เนื้อหาต่อ profile (KPI/chart/action — **ข้อมูลจริงเท่านั้น**)

| Profile (titleEn) | KPI (มีข้อมูลจริง) | ปุ่ม action ในตาราง | chart analytics | ตัดออก (ไม่มีข้อมูล) |
|---|---|---|---|---|
| **Administrator** | ผู้ใช้ทั้งหมด · active · จำนวน user/role · งานค้างรวม · daily-check ค้าง | (link) | บาร์ user ต่อ role · donut สถานะคำร้อง | system errors |
| **Lab Analyze** | รอวิเคราะห์ · กำลังวิเคราะห์ · เสร็จวันนี้ · งานตีกลับ/retest | บันทึกผล | donut สถานะงานฉัน | due soon · turnaround time |
| **Lab Data Config** | simple-method ที่ยังขาด (commonName ไม่มี entry) · master item อัปเดตล่าสุด | ดูรายละเอียด | — (widget น้อย ตามที่ยอมรับ) | config errors · pending approvals |
| **Lab Head** | รออนุมัติ Lab · ผลผิดปกติ · งานกำลังทำรวม | อนุมัติ | บาร์ workload ต่อผู้วิเคราะห์ | overdue · completion trend |
| **Lab Inventory** | สต๊อกต่ำ · ใกล้หมดอายุ · เบิกวันนี้ (transactions) | จัดการสต๊อก | บาร์ เบิกต่อวัน (client window) | pending receipts · discrepancies |
| **QC Staff** | งาน assigned · รอตรวจรับ · รอส่ง Lab · เสร็จวันนี้ · ตีกลับ | ตรวจรับ/ส่ง Lab | pipeline บาร์ | due soon |
| **QC Reviewer** | รอ review · out-of-spec (abnormal) · ตีกลับ · อนุมัติวันนี้ | อนุมัติผล | donut ปกติ/ผิดปกติ (approx) | SLA risk |
| **QC Head** | รออนุมัติ · ผลผิดปกติ · งานต่อแผนก · อัตราปกติ (approx) | อนุมัติ | บาร์ งานต่อแผนก · donut ปกติ/ผิดปกติ | overdue · trend เชิงเวลา |
| **Viewer** | คำขอรวม · กำลังดำเนินการ · เสร็จ · อัตราปกติ (approx) | (read-only) | donut สถานะ · บาร์ request ต่อวัน (client window) | monthly trend · saved reports |

หมายเหตุ: "อัตราปกติ" = approximation จาก abnormal flags เทียบ total (ในช่วงข้อมูลที่ดึง) — ระบุ caveat บน chart

### §6 Routing consolidation

- `/home` = `RoleDashboard` (ทางเดียว)
- `/dashboard/lab`, `/dashboard/qc` → `<Navigate to="/home" replace />`
- `AppSidebar` "/" → `/home`
- `/queue/lab`, `/queue/qc` (TV board) — **ไม่แตะ**

### §7 จุดแก้ role → profile (surface ขั้นต่ำใน spec นี้)

ต่อยอด `DashboardLayoutConfigCard.tsx` ใน Settings → เพิ่มตัวเลือก **map role → dashboard profile** (dropdown ต่อ role, บันทึกที่ `Role.dashboardProfile`). ให้ admin ทดลอง/สลับ profile ได้ครบ 9. UI จัดการ user/role เต็มรูป = spec B

### §8 Data layer & caveat

- `useDashboardData(profile, range)` ดึงเฉพาะแหล่งที่ widget ของ profile ต้องใช้ (petitions/samples/stock/daily-check/audit) — reuse hook เดิม, memoize
- KPI compute แยกเป็น **pure function** (`computeKpis(profile, data, range)`) เพื่อ unit-test ได้
- **Caveat (เขียนในสเปค + comment โค้ด):** petition ดึง client-side (~100, อาจขยายเป็น ~200 สำหรับแดชบอร์ด). ค่า total/trend = "ในช่วงข้อมูลที่ดึง" ไม่แม่นระดับ historical. **ไม่เพิ่ม backend aggregate** ตามการตัดสินใจข้อ 3 — ถ้าต้องการ metric เชิงเวลาแม่นๆ เป็นงาน follow-up

### §9 Testing

- Vitest co-located:
  - `dashboardProfiles.test.ts`: `resolveProfileForRole` (default map + `dashboardProfile` override), `resolveActiveRole` (stored ใน roles / fallback primary), multi-role
  - KPI compute pure fn: fixture petitions/samples/stock → count ที่คาดหวัง, delta เฉพาะที่มี prior, date-range filter
  - shift/date header logic
- Playwright (option): flow สลับ active role → title/KPI/sidebar เปลี่ยน
- `npx tsc -p tsconfig.app.json` (type-check จริง), `npm run lint`

### §10 นอกขอบเขต (ชัดเจน)

- **User & Role management UI เต็มรูป** → spec B (tags ในตาราง, drawer/modal เลือก role, search/filter/pagination, role card + 3-dot menu, กันลบ role ที่มี user)
- Backend aggregate endpoint ใหม่ · metric เชิงเวลา (trend/turnaround/SLA/pass-rate over time)
- สร้าง + assign user ให้ 9 role จริง → spec B
- delta "เทียบช่วงก่อน" สำหรับ KPI ที่ไม่มีข้อมูลเทียบ (ซ่อน)
- system errors, config errors, stock discrepancies, pending receipts, saved reports (ไม่มีแหล่งข้อมูล)

## ลำดับ implement (คร่าว — ทำ plan ละเอียดต่อ)

1. `Role.dashboardProfile` (server) + access-control รับ/คืน
2. `dashboardProfiles.ts` registry + resolvers + test
3. `useActiveRole` + `useDashboardData` + pure `computeKpis` + test
4. `DashboardHeader` (+ active-role switcher) → `KpiRow` → `ActionTable`/`WorkflowSummary` → `AnalyticsSection` → `ActivityTimeline`
5. `RoleDashboard` ประกอบ + `Home.tsx` render มัน
6. Routing: redirect `/dashboard/{lab,qc}`, sidebar "/" + กรอง nav ตาม active role
7. Settings: map role→profile
8. ลบ Home*/LabDashboard/QCDashboard หลัง reuse ครบ
9. type-check + lint + manual E2E (verify browser จริงตาม pattern โปรเจกต์)
