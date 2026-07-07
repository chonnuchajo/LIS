# User & Role Management Redesign (spec B)

วันที่: 2026-07-06
Branch: develop
Status: อนุมัติดีไซน์แล้ว — รอเขียน implementation plan
ไฟล์หลัก: `src/pages/AccessControl.tsx` (แตก) + `src/components/lis/access/*` (ใหม่) + `src/lib/accessDerive.ts` (ใหม่) + `server/routes/accessControl.js` (guard)

> spec B ของคู่ [spec A = role-based dashboard redesign](2026-07-06-role-based-dashboard-redesign-design.md) ซึ่ง implement เสร็จแล้ว
> ขอบเขต: redesign **Users tab + Roles tab** ของหน้า AccessControl เท่านั้น. Groups + Access Matrix tab คงเดิม

## เป้าหมาย

หน้า User & Role management (AccessControl) ให้ทันสมัย อ่านง่าย จัดการเร็ว:
- ตาราง user โชว์ role เป็น **tags** (ไม่ใช่ toggle-chip แก้ inline), ย้ายการแก้ role ไป **side drawer**
- เพิ่ม **ค้นหา + filter (แผนก/role/สถานะ) + pagination**
- Roles เป็น **card** โชว์ ชื่อ/คำอธิบาย/จำนวน user/จำนวน permission/โมดูลที่เข้าถึง + เมนู 3 จุด
- ซ่อนปุ่มลบ (destructive) ในเมนู, **กันลบ role ที่ยังมี user** (UI + server)
- คงสไตล์เดิม: ขาว/เทาอ่อน, primary น้ำเงิน, การ์ดมุมมน, compact, label ไทย

## บริบทที่เกี่ยวข้อง (ของเดิม)

- `src/pages/AccessControl.tsx` (1529 บรรทัด, ใหญ่เกิน) — `<AppLayout>` + `PageHeader` + `<Tabs>` 4 แท็บ:
  1. **Users** (:858) — inline "add user" row (name/email/role toggle-chips) + `<Table>` (avatar+name+email, employee-link chip → dialog, department, position, **Role = toggle-chip ต่อ role** multi, status `<Select>`, last-active, delete). ปุ่ม "Sync พนักงาน".
  2. **Roles** (:1057) — "Create Role" form + grid role cards (perm count + user count + delete).
  3. **Group Control** (:1115) + 4. **Access Matrix** (:1296) — กลไกแก้ permission (คงเดิม, ไม่แตะ).
- Types (`AccessControl.tsx:38-91`):
  - `AppUser = { id; name; email; roleId; roleIds: string[]; department; position; employeeId; status: UserStatus; lastActive }`
  - `Role = { id; name; description; locked? }`
  - `AccessGroup = { id; name; description; paths: string[]; locked?; sortOrder? }`
  - `AccessControlState = { users: AppUser[]; roles: Role[]; groups: AccessGroup[]; permissions: Record<roleId, string[]> }`
- API (มีอยู่): `api.get/post/patch/delete("/access-control/users|roles|groups")`, `api.put("/access-control/roles/:id/permissions")`, `POST /access-control/users/sync-employees`. server `formatUser`/`formatRole` (spec A เพิ่ม `dashboardProfile` ใน formatRole แล้ว).
- `NAV_ITEMS` (`src/lib/navItems.ts`) = ป้าย+path ของเมนู; ใช้ map path→ป้ายโมดูล.
- Server: `DELETE /roles/:id` (`server/routes/accessControl.js`) — ปัจจุบันกัน `locked` แต่ **ไม่กัน role ที่มี user**.

## การตัดสินใจ (ยืนยันกับผู้ใช้)

1. **redesign แค่ Users + Roles tab** — Groups + Access Matrix คงเดิม
2. **แก้ role ของ user ผ่าน Side drawer (Sheet)** — ไม่ใช่ toggle-chip ในตาราง; "+ เพิ่มผู้ใช้" ก็เปิด drawer โหมดสร้าง (แทน inline add row)
3. **กันลบ role ที่มี user: UI + server** — UI ซ่อน/disable ปุ่มลบเมื่อ userCount>0/locked; backend `DELETE /roles/:id` ตอบ **409** ถ้ายังมี user
4. **แตกเป็น component ย่อย** — UsersTab/RolesTab/UserRoleDrawer/RoleCard/RoleEditDialog + accessDerive.ts; AccessControl.tsx เหลือ shell
5. **filter + pagination = client-side** (users โหลดทั้งก้อนอยู่แล้ว)
6. **โมดูลที่เข้าถึง** = derive จาก `permissions[roleId]` → ป้าย group/nav (dedupe, ตัด 5 + "+N")
7. **drawer แก้** roles(multi, ≥1) + status + employee link (ตรงกับความสามารถเดิม); dept/position เป็น read-only ใน drawer (มาจาก employee directory)

## ดีไซน์

### §1 โครง/ไฟล์

| ไฟล์ | สถานะ | บทบาท |
|---|---|---|
| `src/pages/AccessControl.tsx` | แก้ (slim) | โหลด `AccessControlState` + Tabs shell + ส่ง data/callback ลง `<UsersTab/>`/`<RolesTab/>`; Groups/Matrix คง inline |
| `src/components/lis/access/UsersTab.tsx` | ใหม่ | toolbar (search+filters) + ตาราง (role tags) + pagination + เปิด drawer |
| `src/components/lis/access/UserRoleDrawer.tsx` | ใหม่ | Sheet ขวา: แก้ roles/status/employee link (+ โหมดสร้าง user) + save |
| `src/components/lis/access/RolesTab.tsx` | ใหม่ | ปุ่มสร้าง + grid `<RoleCard/>` |
| `src/components/lis/access/RoleCard.tsx` | ใหม่ | ชื่อ/คำอธิบาย/#users/#perms/modules/⋮ menu |
| `src/components/lis/access/RoleEditDialog.tsx` | ใหม่ | สร้าง/แก้ role (name+description) |
| `src/lib/accessDerive.ts` | ใหม่ | pure helpers (+ `.test.ts`) |
| `server/routes/accessControl.js` | แก้ | `DELETE /roles/:id` guard 409 (+ pure helper `roleInUse`) |

### §2 UsersTab

```
┌ Users ─────────────────────────────────────────────────────────────────┐
│ [🔍 ชื่อ/อีเมล/รหัสพนักงาน]  [แผนก▼][Role▼][สถานะ▼]   [+ เพิ่มผู้ใช้][⋯ Sync] │
├──────────────────────────────────────────────────────────────────────────┤
│ ผู้ใช้            แผนก·ตำแหน่ง    Roles           สถานะ    ล่าสุด    ⋮        │
│ 👤 สมชาย ส.       QC·นักวิเคราะห์  [QC][Lab]       ●ใช้งาน   2 ชม.    ⋮        │
├──────────────────────────────────────────────────────────────────────────┤
│                           ‹ 1 2 3 ›   ต่อหน้า [25▼]   ทั้งหมด 120 คน        │
└──────────────────────────────────────────────────────────────────────────┘
```
- **Role column = tags อ่านอย่างเดียว** (ชื่อ role จาก `user.roleIds` map ผ่าน roles); ถ้าไม่มี role → "—"
- **Toolbar filters (client-side, ประกอบใน accessDerive):**
  - search: match `name`/`email`/`employeeId` (case-insensitive, contains)
  - แผนก: distinct `department` จาก users (+ "ทั้งหมด")
  - Role: จาก `roles` (+ "ทั้งหมด") — match user ที่ `roleIds` includes
  - สถานะ: active/inactive (+ "ทั้งหมด")
- **Pagination client-side:** ต่อหน้า 25/50/100, reset หน้า=1 เมื่อ filter เปลี่ยน
- คลิกแถว (หรือ ⋮ → "แก้ไข") → `UserRoleDrawer` (โหมดแก้); "+ เพิ่มผู้ใช้" → drawer โหมดสร้าง; "⋯ Sync" = `POST /access-control/users/sync-employees` (เดิม)
- คอลัมน์: ผู้ใช้ (avatar+ชื่อ+อีเมล) · แผนก·ตำแหน่ง · Roles(tags) · สถานะ(badge) · ล่าสุด(lastActive) · ⋮

### §3 UserRoleDrawer (Sheet ขวา)

- header: avatar + ชื่อ + อีเมล + ปุ่มผูก/เปลี่ยน employee (เปิด employee-directory dialog เดิม)
- body: **เลือก role หลายอัน** (รายการ role มี checkbox/toggle, คงอย่างน้อย 1 — กันติ๊กออกหมด); **สถานะ** (active/inactive toggle); dept/position **read-only** (จาก employee link)
- footer: บันทึก / ยกเลิก. บันทึกยิง api เดิม (patch roleIds/status ต่อ user; ผูก employee)
- **โหมดสร้าง user:** header เป็นฟอร์ม name/email + เลือก role; บันทึก = `POST /access-control/users`
- ปิด drawer แล้ว refetch/optimistic update ตาราง

### §4 RolesTab + RoleCard

```
┌ Roles ───────────────────────────────────────────────────┐
│ [+ สร้าง Role]                                             │
│ ┌ QC Reviewer ───────────────── ⋮ ┐  ┌ Lab Analyst ── ⋮ ┐ │
│ │ Review and approve results        │  │ Sample handling… │ │
│ │ 👥 8 คน · 🔑 12 สิทธิ์            │  │ 👥 5 · 🔑 9      │ │
│ │ โมดูล: QC, Lab, รายงาน +2         │  │ โมดูล: Lab, Stock│ │
│ └───────────────────────────────────┘  └──────────────────┘ │
└───────────────────────────────────────────────────────────┘
```
- **RoleCard:** ชื่อ · description · `👥 #users` (`countUsersInRole`) · `🔑 #permissions` (`rolePermissionCount`) · **โมดูลที่เข้าถึง** (chips จาก `accessibleModules`, โชว์ ≤5 + "+N") · badge "locked" ถ้า locked
- **⋮ menu:** "แก้ไข" → `RoleEditDialog` (name/description); "ลบ" (สีแดง) — **`locked` → ไม่มีรายการลบเลย; `#users>0` → รายการลบ disabled + tooltip "มีผู้ใช้ N คนอยู่"** (โชว์ให้เห็นว่าทำไมลบไม่ได้); ลบได้ → confirm dialog → `DELETE /roles/:id`
- **"+ สร้าง Role"** → `RoleEditDialog` โหมดสร้าง (`POST /access-control/roles`)
- หมายเหตุ: การแก้ **permission** ของ role ยังอยู่ที่ Access Matrix tab (คงเดิม) — RoleCard ไม่แก้ permission

### §5 Server guard (`server/routes/accessControl.js`)

- แยก pure helper `roleInUse(users, roleId)` → boolean (user ใดมี `roleIds` includes roleId หรือ `roleId === roleId`)
- `DELETE /roles/:id`: คง locked guard เดิม; เพิ่ม — โหลด users, ถ้า `roleInUse` → **`409 { error: "role has assigned users", userCount }`**
- FE จับ 409 → toast "ลบไม่ได้: ยังมีผู้ใช้ N คนใช้ role นี้"

### §6 accessDerive.ts (pure, tested)

```ts
filterUsers(users, { search?, dept?, role?, status? }): AppUser[]
paginate<T>(list: T[], page: number, pageSize: number): { items: T[]; total: number; pageCount: number }
countUsersInRole(users, roleId): number
rolePermissionCount(permissions, roleId): number
accessibleModules(permissions, roleId, groups): string[]   // ป้ายโมดูล dedupe (group.name / nav label)
distinctDepartments(users): string[]
```
- `accessibleModules`: สำหรับแต่ละ perm ใน `permissions[roleId]` — ถ้าเป็น group id → `group.name`; ถ้าเป็น path → ป้ายจาก NAV_ITEMS (match); dedupe, กรอง falsy

### §7 Testing

- Vitest `accessDerive.test.ts`: filterUsers (search/dept/role/status + รวมกัน), paginate (ขอบ/หน้าเกิน), countUsersInRole, rolePermissionCount, accessibleModules (group+path+dedupe)
- Server `node --test`: `roleInUse` (roleIds / legacy roleId / ไม่มี)
- Type-check `npx tsc -p tsconfig.app.json --noEmit`, lint
- Manual E2E: search/filter/pagination, drawer เพิ่ม/แก้ role+status, สร้าง/แก้ role, ลบ role (ไม่มี user = ได้, มี user = 409 toast, locked = ปุ่มหาย)

### §8 นอกขอบเขต

Groups + Access Matrix tab (คงเดิม) · permission model/แก้ permission ต่อ role · role→dashboardProfile (อยู่ Settings จาก spec A) · server-side pagination/search · การแก้ dept/position (มาจาก employee directory)

## ลำดับ implement (คร่าว — plan ละเอียดต่อ)

1. `accessDerive.ts` + test
2. server `roleInUse` + DELETE guard 409 + test
3. `UserRoleDrawer` (แก้/สร้าง)
4. `UsersTab` (toolbar+filters+pagination+tags+drawer) — แทน Users tab เดิม
5. `RoleCard` + `RoleEditDialog` + `RolesTab` — แทน Roles tab เดิม
6. slim `AccessControl.tsx` (delegate 2 tab, คง Groups/Matrix) + จับ 409
7. tsc + lint + manual E2E
