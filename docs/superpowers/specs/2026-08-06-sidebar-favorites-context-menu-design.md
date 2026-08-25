# Sidebar: คลิกขวา (context menu) + รายการโปรด

วันที่: 2026-08-06
สถานะ: อนุมัติดีไซน์แล้ว รอเขียนแผน implement

## ปัญหา

Sidebar มีเมนู 23 รายการ (`NAV_ITEMS`) จัดกลุ่มตาม access-control group ผู้ใช้แต่ละคนใช้จริงแค่ 3–5 หน้า
แต่ต้องเลื่อนหาทุกครั้ง และไม่มีทางลัดเปิดหน้าในแท็บใหม่หรือคัดลอกลิงก์ไปส่งต่อ

## ขอบเขต

- คลิกขวาที่รายการเมนูใน sidebar → context menu 4 คำสั่ง
- กลุ่ม "รายการโปรด" ปักบนสุดของ sidebar เรียงลำดับเองได้
- เก็บบน server ผูกกับ user (ข้ามเครื่องได้)

**ไม่อยู่ในขอบเขต:** คลิกขวาที่อื่นนอก sidebar (แถวตาราง, การ์ด dashboard), favorite หน้าที่ไม่ได้อยู่ใน `NAV_ITEMS`,
การนับสถิติ "หน้าที่ใช้บ่อย" อัตโนมัติ

## สถาปัตยกรรม

### Backend

**`server/models/UserFavorite.js`** — model ใหม่

```js
{ email: String (required, lowercase, unique index), paths: [String] }  // timestamps: true
```

- key ด้วย **email ไม่ใช่ user `_id`** เพราะ dev mode ใช้ `synthesizeDevUser` (`src/config/dev.ts:163`)
  ซึ่งให้ id สังเคราะห์ (`dev-lab-analyst`) ที่ไม่มี User doc รองรับ — email (`lab-analyst.dev@icpladda.com`) มีครบทั้ง dev/prod
- **ไม่ใส่ `softDeletePlugin`** — เป็น upsert-only config เหมือน `DashboardLayoutConfig` / `EnvRoomConfig`
  ไม่มี route ที่ลบ doc (การเอาออกจากรายการโปรด = เขียน `paths` ใหม่)
- collection ใหม่ถูก `npm run seed:export` เก็บอัตโนมัติ (`listCollections()` แบบ dynamic) ไม่ต้อง wire เพิ่ม

**`server/routes/userFavorites.js`** — mount `mountApi('/user-favorites', ...)` ใน `server/index.js`

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/user-favorites?email=` | — | `{ data: { email, paths } }` — ไม่มี doc → `paths: []` |
| PUT | `/user-favorites` | `{ email, paths }` | `{ data: { email, paths } }` (upsert) |

Validation ของ `PUT` (ทำใน `server/lib/favorites.js` เพื่อให้ unit test ได้แยกจาก express):

- `email` ต้องไม่ว่าง → ไม่งั้น 400
- `paths` ต้องเป็น array ของ string ที่ขึ้นต้นด้วย `/` และยาวไม่เกิน 100 ตัวอักษร — ตัวที่ไม่ผ่านถูกทิ้งเงียบ ๆ
- dedup โดยคงลำดับแรกที่เจอ, ตัดเหลือ **20 รายการแรก**
- ไม่ validate ว่า path มีอยู่จริงใน `NAV_ITEMS` — server ไม่รู้จัก nav catalog ของ frontend
  (ฝั่ง client กรองด้วย `normalizeFavorites` ตอน render อยู่แล้ว)

### Frontend

**`src/lib/favorites.ts`** — pure function ล้วน ไม่มี React/network มี `favorites.test.ts` คู่กัน (Vitest ตามแนวไฟล์อื่นใน `src/lib/`)

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `toggleFavorite(paths, path)` | มีอยู่ → เอาออก, ไม่มี → ต่อท้าย; คืน array ใหม่เสมอ |
| `moveFavorite(paths, path, dir)` | สลับกับเพื่อนบ้าน; อยู่หัว/ท้ายแล้วหรือหาไม่เจอ → คืน array เดิม (identity เดิม) |
| `normalizeFavorites(paths, knownPaths)` | dedup + ทิ้ง path ที่ไม่อยู่ใน `knownPaths` + cap 20 |

**`src/hooks/useFavorites.ts`**

- `useQuery` key `["user-favorites", email]`, `staleTime` 5 นาที, `enabled: !!email`
- `useMutation` เขียน `PUT` แบบ **optimistic update**: `setQueryData` ก่อน แล้ว rollback ใน `onError`, `invalidateQueries` ใน `onSettled`
- คืน `{ favorites, isFavorite(path), toggle(path), move(path, dir), isReady }`
- ไม่มี email (เช่นยังไม่ล็อกอินเสร็จ) → `favorites` เป็น `[]` และ `toggle`/`move` เป็น no-op

**`src/lib/api.ts`** — เพิ่ม `getUserFavorites(email)` และ `saveUserFavorites(email, paths)`

**`src/components/lis/NavItemContextMenu.tsx`** — ครอบ nav link ด้วย `ContextMenu` ของ shadcn
(`src/components/ui/context-menu.tsx` มีอยู่แล้ว — Radix ติดตั้งแล้ว ไม่ต้องเพิ่ม dependency)

Props: `{ path, label, isFavorite, inFavorites, canMoveUp, canMoveDown, onToggleFavorite, onMove, children }`

รายการเมนู:

| ไอคอน | ป้าย | การทำงาน |
|---|---|---|
| `Star` / `StarOff` | `เพิ่มในรายการโปรด` / `เอาออกจากรายการโปรด` | `onToggleFavorite()` |
| `ExternalLink` | `เปิดในแท็บใหม่` | `window.open(BASE_URL + path, "_blank", "noopener")` — ได้ prefix `/LIS/` ถูกในโปรดักชัน |
| `Link2` | `คัดลอกลิงก์` | `navigator.clipboard.writeText(origin + BASE_URL + path)` + fallback `<textarea>` + `execCommand("copy")` เผื่อ context ไม่ secure |
| `ArrowUp` / `ArrowDown` | `ย้ายขึ้น` / `ย้ายลง` | render เฉพาะเมื่อ `inFavorites`; `disabled` ที่หัว/ท้ายรายการ |

**`src/components/lis/AppSidebar.tsx`** — จุดแก้

1. เรียก `useFavorites()`; สร้าง section เสมือน `{ id: "favorites", label: "รายการโปรด", items }`
   โดย `items` map จาก `normalizeFavorites(favorites, NAV_ITEMS.map(i => i.path))` → `NAV_ITEMS` (คงลำดับตาม `favorites` ไม่ใช่ลำดับ `NAV_ITEMS`)
2. `sections` ที่มีอยู่ = `[favoritesSection, ...groupSections]` — favorites มาก่อนกลุ่มจาก access-control เสมอ
3. ผ่านตัวกรองเดิมทุกอย่าง: `userCanAccessPath` (ถูกถอนสิทธิ์ → **ซ่อน ไม่ลบ** ข้อมูลออกจาก DB) และช่องค้นหา `menuQuery`
4. `visibleItems.length === 0` → ไม่ render (โค้ดเดิมทำอยู่แล้ว) ⇒ ยังไม่มี fav ก็ไม่มีกลุ่มโผล่
5. ย่อ/ขยายกลุ่มได้ + จำสถานะผ่าน `collapsedGroups` เดิม (`lis.sidebar.collapsedGroups`)
6. โหมดพับ rail (`collapsed`) → โชว์เฉพาะไอคอน มีเส้นคั่นเหมือนกลุ่มอื่น context menu ยังใช้ได้
7. **เมนูที่ถูก fav ยังคงแสดงในกลุ่มเดิมด้วย** (เห็น 2 ที่ เหมือน bookmarks bar) — muscle memory ของตำแหน่งเดิมไม่พัง
8. `key` ของ item ต้องเป็น `${section.id}:${item.path}` ไม่ใช่ `item.path` เฉย ๆ เพราะตอนนี้ path ซ้ำได้ 2 section

**การซ้อน trigger:** ทั้ง `TooltipTrigger` (โหมดพับ) และ `ContextMenuTrigger` ใช้ `asChild` ซ้อนกันลงบน `<Link>` ตัวเดียว
โครง: `<ContextMenu><Tooltip><TooltipTrigger asChild><ContextMenuTrigger asChild><Link/></ContextMenuTrigger></TooltipTrigger>…`

## Data flow

```
AppSidebar
  └─ useFavorites(email จาก useAuth)
       ├─ GET /user-favorites?email=…  ──► UserFavorite doc
       └─ toggle/move → optimistic setQueryData → PUT /user-favorites → invalidate
```

Frontend เป็นเจ้าของลำดับทั้งหมด — server แค่รับ array ไปเก็บ ไม่มี logic เรียง

## Error handling

| กรณี | พฤติกรรม |
|---|---|
| GET ล้มเหลว / server ไม่ขึ้น | `favorites = []` → กลุ่มไม่โผล่ sidebar ที่เหลือทำงานปกติ |
| PUT ล้มเหลว | rollback optimistic update + toast `บันทึกรายการโปรดไม่สำเร็จ` |
| ยังไม่มี email (auth กำลังโหลด) | query `disabled`, `toggle`/`move` เป็น no-op |
| favorite ชี้ path ที่ผู้ใช้ถูกถอนสิทธิ์ | ซ่อนจาก sidebar แต่ยังอยู่ใน DB (คืนสิทธิ์แล้วกลับมาเอง) |
| clipboard เขียนไม่ได้ | fallback `execCommand`; ล้มทั้งคู่ → toast แจ้ง |

## Testing

- `src/lib/favorites.test.ts` — Vitest ครอบ `toggleFavorite` / `moveFavorite` / `normalizeFavorites`
  (เพิ่ม, เอาออก, ย้ายที่หัว/ท้าย, path ซ้ำ, path ที่ไม่รู้จัก, cap 20)
- `server/lib/favorites.test.js` — Jest ครอบ `sanitizePaths` (ทิ้ง non-string / path ที่ไม่ขึ้นต้น `/` / ยาวเกิน, dedup, cap)
- `src/components/lis/__tests__/AppSidebar.test.tsx` (มีอยู่แล้ว) — เพิ่มเคส: มี fav → กลุ่มโผล่บนสุดเรียงตามที่เก็บ, ไม่มี fav → ไม่มีกลุ่ม, fav ที่ไม่มีสิทธิ์ → ไม่โผล่

## ความเสี่ยงที่รู้ตัวแล้ว

- **Radix pointer-events lock** — ปิด context menu แล้ว body อาจค้าง `pointer-events: none` กดเมนูไม่ได้
  (เคยเจอกับ dialog มาแล้ว → มี `RoutePointerLockGuard` global อยู่) ต้องทดสอบจริงว่ากันครอบคลุมถึง context menu ด้วย
- **คลิกขวาบนมือถือ/แท็บเล็ต** — Radix map long-press ให้ ใช้ได้ทั้ง drawer variant ไม่ต้องทำเพิ่ม
