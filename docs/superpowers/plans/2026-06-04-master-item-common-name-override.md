# Master Item — Override commonname (✎ inline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม ✎ inline ข้างคอลัมน์ commonname ในหน้า Master Item ให้ override `commonname` ได้ โดยใช้ `CommonNameOverride` layer ตัวเดียวกับ Simple Method และโชว์ค่า canonical ในตารางทันที

**Architecture:** Frontend-only change ใน `src/pages/MasterItems.tsx`. Refactor `CommonNameOverrideDialog` (ที่ใช้อยู่แล้วใน `SimpleMethodPage`) ให้รับ props กลาง แล้ว reuse ใน `MasterItems()` component. Backend (`/common-name-overrides`) และ helper (`src/lib/commonNameOverride.ts`) มีครบแล้ว ไม่แตะ.

**Tech Stack:** React 18 + TypeScript + TanStack React Query + shadcn/ui. Type-check ด้วย `npx tsc --noEmit`, test ด้วย Vitest (`npm run test`).

**สำคัญ — concurrent committer:** branch `develop` บางครั้งมี process อื่น commit แทรก → ทุก commit ใช้ explicit pathspec (`git add <file>`) เท่านั้น ห้าม `git add -A` / `git add .`

---

### Task 1: Refactor `CommonNameOverrideDialog` ให้รับ props กลาง

ตอนนี้ dialog รับ `row: SimpleMethodRow` ทำให้ reuse จาก Master Item ไม่ได้ (Master Item ไม่มี SimpleMethodRow). เปลี่ยนให้รับ `rawCommonNames: string[]` + `initialCanonical: string` แล้วแก้ call site เดิมใน `SimpleMethodPage` ให้พฤติกรรมเหมือนเดิม.

**Files:**
- Modify: `src/pages/MasterItems.tsx` (component `CommonNameOverrideDialog` ≈ บรรทัด 1441–1505; call site ใน `SimpleMethodPage` ≈ บรรทัด 1010–1018)

- [ ] **Step 1: แก้ signature + body ของ `CommonNameOverrideDialog`**

หาบล็อก (เริ่ม ≈ บรรทัด 1441):

```tsx
function CommonNameOverrideDialog({
  row,
  onClose,
  onSaved,
}: {
  row: SimpleMethodRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [canonical, setCanonical] = useState(row.commonName);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = canonical.trim();
    if (!value) {
      toast.error("กรุณาระบุชื่อมาตรฐาน");
      return;
    }
    setBusy(true);
    try {
      // apply the same canonical to every raw common_name that fell into this row
      for (const raw of row.rawCommonNames) {
        await api.post("/common-name-overrides", { raw, canonical: value, note: note.trim() });
      }
      toast.success("ตั้งชื่อมาตรฐานสำเร็จ");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
```

แทนด้วย:

```tsx
function CommonNameOverrideDialog({
  rawCommonNames,
  initialCanonical,
  onClose,
  onSaved,
}: {
  rawCommonNames: string[];
  initialCanonical: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [canonical, setCanonical] = useState(initialCanonical);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = canonical.trim();
    if (!value) {
      toast.error("กรุณาระบุชื่อมาตรฐาน");
      return;
    }
    setBusy(true);
    try {
      // apply the same canonical to every raw common_name passed in
      for (const raw of rawCommonNames) {
        await api.post("/common-name-overrides", { raw, canonical: value, note: note.trim() });
      }
      toast.success("ตั้งชื่อมาตรฐานสำเร็จ");
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
```

- [ ] **Step 2: แก้ส่วน JSX ของ dialog ที่อ้าง `row.rawCommonNames`**

ในตัว dialog มีบรรทัด (≈ 1486):

```tsx
              {row.rawCommonNames.map((raw) => <li key={raw}>{raw}</li>)}
```

แทนด้วย:

```tsx
              {rawCommonNames.map((raw) => <li key={raw}>{raw}</li>)}
```

(ไม่มีการอ้าง `row.` อื่นใน dialog แล้ว — `row.commonName` ถูกแทนด้วย `initialCanonical` ใน state ไปแล้วใน Step 1)

- [ ] **Step 3: แก้ call site ใน `SimpleMethodPage`**

หาบล็อก (≈ บรรทัด 1010):

```tsx
        {editingRow && (
          <CommonNameOverrideDialog
            row={editingRow}
            onClose={() => setEditingRow(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["common-name-overrides"] });
            }}
          />
        )}
```

แทนด้วย:

```tsx
        {editingRow && (
          <CommonNameOverrideDialog
            rawCommonNames={editingRow.rawCommonNames}
            initialCanonical={editingRow.commonName}
            onClose={() => setEditingRow(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["common-name-overrides"] });
            }}
          />
        )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error (โดยเฉพาะไม่มี error เกี่ยว `CommonNameOverrideDialog` props)

- [ ] **Step 5: Regression test — ยืนยัน Simple Method ไม่พัง**

Run: `npm run test`
Expected: ผ่านทั้งหมด (รวม `buildSimpleMethodRows.test.ts`, `commonNameOverride.test.ts`)

- [ ] **Step 6: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "refactor(common-name-override): make dialog accept generic props"
```

---

### Task 2: เพิ่ม query + cnMap + enrichedItems fields + state ใน `MasterItems()`

โหลด `CommonNameOverride` เข้าหน้า Master Item, สร้าง cnMap, แล้วคำนวณ `rawCommonName` (จาก item ดิบ) + `displayCommonName` (canonical) ต่อแถว, พร้อมเพิ่ม state สำหรับ dialog.

**Files:**
- Modify: `src/pages/MasterItems.tsx` (component `MasterItems()` ≈ บรรทัด 471–818)

- [ ] **Step 1: เพิ่ม state สำหรับ dialog แก้ commonname**

หาบล็อก state ของ `MasterItems()` (≈ บรรทัด 473–477):

```tsx
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [editing, setEditing] = useState<{ item: MasterItem; originalItemNo: string; override?: MasterItemOverride } | null>(null);
  const [viewing, setViewing] = useState<{ item: MasterItem; originalItemNo: string; override?: MasterItemOverride } | null>(null);
```

เพิ่มบรรทัดต่อท้าย:

```tsx
  const [editingCommonName, setEditingCommonName] = useState<{ rawCommonName: string; currentCanonical: string } | null>(null);
```

- [ ] **Step 2: เพิ่ม query `common-name-overrides` + cnMap**

หาบล็อก query `["parameters"]` ใน `MasterItems()` (≈ บรรทัด 508–511):

```tsx
  const { data: parameters = [] } = useQuery({
    queryKey: ["parameters"],
    queryFn: () => api.getParameters(),
  });
```

เพิ่มต่อท้ายบล็อกนี้:

```tsx
  const { data: cnOverrides = [] } = useQuery({
    queryKey: ["common-name-overrides"],
    queryFn: async () => {
      const res = await api.get<CommonNameOverrideRow[]>("/common-name-overrides");
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
  });

  const cnMap = useMemo(() => buildOverrideMap(cnOverrides), [cnOverrides]);
```

(import `CommonNameOverrideRow`, `buildOverrideMap` มีอยู่แล้วบรรทัด 53–54 — ไม่ต้องเพิ่ม)

- [ ] **Step 3: เพิ่ม `rawCommonName` + `displayCommonName` ใน `enrichedItems`**

หาบล็อก (≈ บรรทัด 513–524):

```tsx
  const enrichedItems = useMemo(
    () => items.map((item) => {
      const originalItemNo = String(firstValue(item, codeKeys)).trim();
      const override = overrideMap[originalItemNo];
      return {
        item: applyOverride(item, override),
        originalItemNo,
        override,
      };
    }),
    [items, overrideMap],
  );
```

แทนด้วย (อ่าน `rawCommonName` จาก item **ดิบ ก่อน** `applyOverride`):

```tsx
  const enrichedItems = useMemo(
    () => items.map((item) => {
      const originalItemNo = String(firstValue(item, codeKeys)).trim();
      const override = overrideMap[originalItemNo];
      const rawCommonName = String(firstValue(item, commonNameKeys)).trim();
      return {
        item: applyOverride(item, override),
        originalItemNo,
        override,
        rawCommonName,
        displayCommonName: normalizeCommonName(rawCommonName, cnMap),
      };
    }),
    [items, overrideMap, cnMap],
  );
```

(`commonNameKeys` ประกาศไว้บรรทัด 151, `normalizeCommonName` import แล้วบรรทัด 53)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(master-item): load common-name-override layer + per-row canonical"
```

---

### Task 3: คอลัมน์ commonname โชว์ canonical + ปุ่ม ✎ + render dialog

ใช้ค่าที่คำนวณใน Task 2 มาแสดงในตาราง + ปุ่มดินสอเปิด dialog, แล้ว render `CommonNameOverrideDialog`.

**Files:**
- Modify: `src/pages/MasterItems.tsx` (table row render + dialog render ใน `MasterItems()`)

- [ ] **Step 1: ดึง `rawCommonName` + `displayCommonName` ออกจาก map destructure ของแถว**

หาบรรทัด (≈ 690) ที่ map `filteredItems`:

```tsx
                      filteredItems.map(({ item, originalItemNo, override }, index) => {
```

แทนด้วย:

```tsx
                      filteredItems.map(({ item, originalItemNo, override, rawCommonName, displayCommonName }, index) => {
```

- [ ] **Step 2: เปลี่ยน cell commonname ให้โชว์ canonical + ปุ่ม ✎**

หา cell (≈ บรรทัด 707):

```tsx
                            <TableCell>{displayValue(firstValue(item, typeKeys))}</TableCell>
```

แทนด้วย:

```tsx
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="min-w-0 flex-1 truncate"
                                  title={displayCommonName !== rawCommonName ? `จากระบบ: ${rawCommonName}` : undefined}
                                >
                                  {displayValue(displayCommonName)}
                                </span>
                                {rawCommonName && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 px-0 text-muted-foreground hover:text-foreground"
                                    title="ตั้งชื่อมาตรฐาน"
                                    aria-label={`ตั้งชื่อมาตรฐาน ${displayCommonName}`}
                                    onClick={() => setEditingCommonName({ rawCommonName, currentCanonical: displayCommonName })}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
```

(`Button`, `Pencil` import แล้ว; pattern ✎ ลอกจาก `SimpleMethodTab` row)

- [ ] **Step 3: Render `CommonNameOverrideDialog` ใน `MasterItems()`**

หาบล็อก render dialog `viewing` (≈ บรรทัด 803–815):

```tsx
        {viewing && (
          <MasterItemDetailDialog
            item={viewing.item}
            originalItemNo={viewing.originalItemNo}
            parameters={getParametersFor(viewing.item, parameters)}
            extraColumns={extraColumns}
            onClose={() => setViewing(null)}
            onEdit={() => {
              setEditing(viewing);
              setViewing(null);
            }}
          />
        )}
```

เพิ่มต่อท้ายบล็อกนี้ (ก่อน `</AppLayout>`):

```tsx
        {editingCommonName && (
          <CommonNameOverrideDialog
            rawCommonNames={[editingCommonName.rawCommonName]}
            initialCanonical={editingCommonName.currentCanonical}
            onClose={() => setEditingCommonName(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["common-name-overrides"] });
            }}
          />
        )}
```

(`queryClient` มีอยู่แล้วใน `MasterItems()` บรรทัด 472)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 5: Regression test**

Run: `npm run test`
Expected: ผ่านทั้งหมด

- [ ] **Step 6: Commit**

```bash
git add src/pages/MasterItems.tsx
git commit -m "feat(master-item): inline edit commonname via shared override dialog"
```

---

### Task 4: Manual verification

ตรวจสอบด้วยตาว่า feature ทำงานครบ (ต้องรัน frontend + backend ตาม CLAUDE.md: `npm run dev` ที่ root + `cd server && npm run dev`).

- [ ] **Step 1: เปิดหน้า Master Item → กด ✎ ข้าง commonname ของ item ใด item หนึ่ง**
  - Expected: dialog "ตั้งชื่อมาตรฐาน (common name)" เปิด, โชว์ค่า raw เดิมใน "ชื่อจากระบบ (raw)", ช่อง "ชื่อมาตรฐาน" pre-fill ด้วยค่า commonname ปัจจุบัน

- [ ] **Step 2: แก้ค่า canonical → กดบันทึก**
  - Expected: toast สำเร็จ, คอลัมน์ commonname ของแถวนั้น (และทุกแถวที่ raw เดียวกัน) อัปเดตเป็นค่าใหม่, hover เห็น "จากระบบ: <raw เดิม>"

- [ ] **Step 3: เปิดหน้า Simple Method**
  - Expected: commonname ที่เพิ่งแก้ไปโผล่เป็น canonical เดียวกัน (shared layer ทำงาน)

- [ ] **Step 4: ที่หน้า Simple Method กด ✎ ของแถวอื่น → ยืนยัน dialog เดิมยังทำงานปกติ**
  - Expected: dialog เปิด/บันทึกได้เหมือนเดิม ไม่มี regression

- [ ] **Step 5 (optional): seed:export ถ้ามี override ใหม่ที่อยากเก็บลง git**

Run: `cd server && npm run seed:export`
แล้ว commit `server/seed-data/commonnameoverrides.json` แยก (explicit pathspec) ถ้ามี diff
