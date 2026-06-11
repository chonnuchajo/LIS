# AI Agent Integration Design — ICPLadda LIS

**Date:** 2026-06-10  
**Status:** Approved  
**Scope:** AI augmentation across all 4 workflow zones (QC Testing, Petition, Daily Check, QC Approval)

---

## 1. Background & Goals

ICPLadda LIS เป็นระบบ Laboratory Information System สำหรับบริษัทยา/แล็บไทย ครอบคลุม petition tracking, lab & QC testing, approval, stock, และ daily operational checks

**เป้าหมาย:** นำ AI เข้ามาเสริมใน 3 มิติพร้อมกัน
1. **ลดงาน manual** — auto-suggest เครื่อง, draft notes, สรุปรายงาน
2. **เพิ่มความแม่นยำ** — จับ outlier, เตือนค่าผิดปกติ, ตรวจ copy-paste
3. **ช่วยตัดสินใจ** — จัดลำดับ approval, วิเคราะห์แนวโน้ม, เตือนซ่อมบำรุง

**ข้อจำกัด:** On-premise เป็นหลัก (Laragon/Windows) — ใช้ external API ได้เฉพาะงานที่ anonymize ข้อมูลได้

---

## 2. Approach: AI-Augmented Workflow (Hybrid)

ใช้ 3 ชั้นของ AI ผสมกัน:

| ชั้น | เทคโนโลยี | ใช้เมื่อ | ค่าใช้จ่าย |
|------|-----------|---------|-----------|
| **Smart Rules** | JavaScript (z-score, linear regression) | Real-time, ทุก request | ฟรี |
| **Ollama (local LLM)** | qwen2.5:7b บน server เดิม | Draft notes, summarize ภาษาไทย | ฟรี (CPU/RAM) |
| **External API** | Claude API | Monthly reports, complex analysis | จ่ายตาม token |

**หลักการสำคัญ: AI เป็น assistant เท่านั้น — ไม่มีส่วนใดที่ AI block การทำงาน ผู้ใช้ override ได้เสมอ**

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ICPLadda LIS Frontend                    │
│         (React + existing pages + new AI hint UI)           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│               Express Backend (port 3001)                   │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │  Existing Routes│  │    NEW: /api/ai/*  routes        │  │
│  │  (unchanged)    │  │  - POST /ai/outlier-check        │  │
│  └─────────────────┘  │  - GET  /ai/machine-suggestions  │  │
│                       │  - GET  /ai/daily-check-trends   │  │
│  ┌─────────────────┐  │  - GET  /ai/approval-priority   │  │
│  │  Smart Rules    │  │  - POST /ai/draft-note           │  │
│  │  (JS, built-in) │  │  - POST /ai/weekly-summary      │  │
│  └─────────────────┘  │  - POST /ai/monthly-report      │  │
│                       └──────────────────────────────────┘  │
└──────────┬──────────────────────────┬───────────────────────┘
           │ On-premise               │ External (selective)
┌──────────▼──────────┐    ┌──────────▼──────────────────────┐
│   Ollama (local)    │    │   Claude API                    │
│   qwen2.5:7b        │    │   (anonymized data only)        │
│   port 11434        │    └─────────────────────────────────┘
└─────────────────────┘
```

**New files:**
- `server/routes/ai.js` — AI routes ทั้งหมด
- `server/lib/smartRules.js` — statistical computation (z-score, regression)
- `server/lib/ollamaClient.js` — Ollama HTTP client wrapper
- `src/hooks/useAiOutlierCheck.ts` — React hook สำหรับ outlier check
- `src/components/lis/AiWarningBadge.tsx` — reusable warning badge component

---

## 4. Zone 1: QC Testing

**หน้าที่แก้:** `src/pages/QCTestingDetailPage.tsx`

### 4.1 Outlier Detection (Real-time)

เมื่อผู้ใช้ key ค่าตัวเลขใน QC field และ blur ออก ระบบจะ:

1. เรียก `POST /api/ai/outlier-check` พร้อม `{ commonName, parameterId, fieldLabel, value }`
2. Backend query `QCTestResult` collection: ดึง last 10 batches ของ `commonName + parameterId` เดียวกัน
3. คำนวณ mean, stdev, z-score ด้วย JavaScript
4. ถ้า `|zScore| > 2.5` → แสดง ⚠️ badge ใต้ field พร้อมข้อความ เช่น `"ค่านี้สูงกว่าปกติ (ค่าเฉลี่ย: 1.82, z = 4.5)"`
5. AI warning ไม่ block การ save — ผู้ใช้ยืนยันได้เสมอ

**API Request/Response:**
```json
POST /api/ai/outlier-check
{ "commonName": "ABAMECTIN 1.8% EC", "parameterId": "...", "fieldLabel": "ความเข้มข้น", "value": 2.5 }

→ { "mean": 1.82, "stdev": 0.15, "zScore": 4.53, "warning": true, "sampleSize": 10 }
→ { "warning": false, "sampleSize": 2, "reason": "insufficient_data" }
```

**เงื่อนไข:** ถ้า sampleSize < 3 → ไม่แสดง warning (ข้อมูลไม่พอ)

### 4.2 Copy-Paste Detection

เมื่อ save QCTestResult ทั้ง petition:
- เปรียบเทียบกับ `lastBatchValues` (API ที่มีอยู่แล้ว)
- ถ้าทุก numeric field เหมือนกัน 100% → แสดง 🔔 banner `"ค่าทุกตัวเหมือน batch ก่อนหน้า — กรุณาตรวจสอบ"`
- เป็นเพียง warning ไม่ block save

### 4.3 Conditional Standard Real-time Evaluation

ใช้ logic ที่มีอยู่แล้วใน `src/lib/parameterValidation.ts` (resolveFieldStandard):
- เรียกใน frontend ขณะ user key ค่า field ที่เป็น trigger
- แสดง banner dynamic: `"เนื่องจาก pH = 7.2 (> 7) มาตรฐาน Hardness ปัจจุบันคือ ≤ 50 mg/L"`

---

## 5. Zone 2: Petition Workflow

### 5.1 Machine Assignment Suggestions

**หน้าที่แก้:** `src/pages/PetitionAssignPage.tsx`

เมื่อเปิดหน้า assign เครื่อง ระบบจะเรียก `GET /api/ai/machine-suggestions?commonName=&dept=` และแสดง suggestion chips เหนือ dropdown:
- `"แนะนำ: GC-01 (ใช้ 8/10 ครั้งล่าสุด)"`
- `"แนะนำ: GC-03 (ใช้ 6/10 ครั้งล่าสุด)"`

**Backend logic:**
```
query Petition ย้อนหลัง 10 batches ที่ commonName + dept ตรงกัน
  → ดึง assignedMachines[]
  → group by machineCode, count frequency
  → return top 3 sorted by count desc
```

**API:**
```json
GET /api/ai/machine-suggestions?commonName=ABAMECTIN%201.8%25%20EC&dept=qc
→ [
    { "machineCode": "GC-01", "machineName": "Gas Chromatograph 01", "usageCount": 8 },
    { "machineCode": "GC-03", "machineName": "Gas Chromatograph 03", "usageCount": 6 }
  ]
```

### 5.2 Parameter Auto-Suggest

**หน้าที่แก้:** `src/pages/PetitionNewPage.tsx` / `PetitionEditPage.tsx`

เมื่อผู้ใช้ไม่ได้กำหนด `testItems`:
- เรียก filter จาก Parameter collection ด้วย `parameterAppliesToItem()` (logic มีอยู่แล้ว)
- แสดง dialog `"พบ 5 parameters ที่ใช้บ่อยกับสินค้าประเภทนี้ — เพิ่มทั้งหมด?"`
- ผู้ใช้ confirm หรือ dismiss ได้เอง

---

## 6. Zone 3: Daily Checks

**หน้าที่แก้:** `src/pages/daily-check/EnvironmentCheckPage.tsx`, `BalanceRoomPage.tsx`, `DailyCheckRecordsPage.tsx`

### 6.1 Sensor Staleness Warning

- ดูเวลา `receivedAt` ของ TempHum record ล่าสุด
- ถ้าเก่ากว่า 10 นาที → แสดง 🔴 `"ข้อมูล sensor เก่า X นาที — กรุณาตรวจสอบ Node-RED"`
- Logic อยู่ใน frontend ได้เลย (ไม่ต้อง API ใหม่)

### 6.2 Consecutive Failure Alert

**API:** `GET /api/ai/daily-check-trends?type=consecutive&scaleId=01&days=7`

Backend logic:
```
query DailyCheck ย้อนหลัง 7 วัน กรอง scaleId
  → หา streak ของ status="fail" ต่อเนื่อง
  → ถ้า streak >= 3 → alert: true, message: "Scale 01 fail ต่อเนื่อง 3 วัน"
```

แสดงเป็น banner สีแดงบนหน้า BalanceRoomPage ก่อนกรอกข้อมูล

### 6.3 Trend Analysis

**API:** `GET /api/ai/daily-check-trends?type=trend&scaleId=01&field=avg100&days=30`

Backend logic:
```
query DailyCheck 30 วัน → ดึงค่า avg100 ต่อวัน
  → คำนวณ linear regression (least squares) ด้วย JS
  → return { slope, unit, alert, message }
```

ถ้า `|slope| > 0.01` (สำหรับ weight fields) หรือ `|slope| > 0.5` (สำหรับ temp/humidity) → แสดง `"น้ำหนักสอบเทียบ 100g มีแนวโน้มเพิ่มขึ้น +0.02g/สัปดาห์"`

### 6.4 Ollama Weekly Summary

ปุ่ม "สรุปรายสัปดาห์" บน DailyCheckRecordsPage:
```
POST /api/ai/weekly-summary
{ "fromDate": "2026-06-03", "toDate": "2026-06-10" }
```

Backend:
1. Aggregate daily check data 7 วัน (scale, env, equipment)
2. สร้าง structured prompt ภาษาไทย
3. ส่งให้ Ollama (qwen2.5:7b)
4. Stream response กลับ

ผลลัพธ์แสดงใน textarea ที่แก้ไขได้ — ผู้ใช้ตรวจก่อนใช้เสมอ

---

## 7. Zone 4: QC Approval

**หน้าที่แก้:** `src/pages/QCApproval.tsx`

### 7.1 Smart Prioritization

เพิ่ม sort logic ฝั่ง frontend (ไม่ต้อง API ใหม่ — ข้อมูลมีอยู่แล้ว):

Priority score ต่อ petition:
```
score = (hasAbnormalFlag ? 30 : 0)
      + (isOverdue24h ? 20 : 0)        // completedAt > 24h ที่แล้ว
      + (isRevision ? 10 : 0)          // revisionOf != null
      + (deptScore)                     // rm=5, fg=3, production=1
```

แสดง badge บนแต่ละ card: 🔴 Abnormal | ⏰ Overdue | 🔄 Revision

### 7.2 Ollama Draft Approval Note

ปุ่ม "Draft หมายเหตุ" บนหน้า detail ของ petition:

```
POST /api/ai/draft-note
{ "petitionId": "..." }
```

Backend:
1. ดึง petition detail, QCTestResult, abnormal flags, tester names
2. สร้าง prompt: `"สร้างหมายเหตุการ approve สินค้า [X] batch [Y] โดยสรุปผลการทดสอบ..."`
3. ส่งให้ Ollama → stream response

ผลลัพธ์ใส่ใน textarea ที่แก้ไขได้ — ไม่ auto-save

---

## 8. Data Privacy

| ข้อมูล | Smart Rules | Ollama | Claude API |
|--------|-------------|--------|-----------|
| ชื่อสินค้าจริง | ✅ ใช้ได้ (local) | ✅ ใช้ได้ (local) | ❌ ไม่ส่ง |
| Batch number | ✅ | ✅ | ❌ |
| ค่าตัวเลขผลทดสอบ | ✅ | ✅ | ✅ (anonymized) |
| Product category | ✅ | ✅ | ✅ |
| ชื่อผู้ทดสอบ | ✅ | ✅ | ❌ |

---

## 9. Error Handling

| กรณี | พฤติกรรม |
|------|---------|
| Ollama ไม่ online | ซ่อนปุ่ม Draft/Summary — แสดง tooltip อธิบาย |
| outlier-check timeout > 2s | skip silently — ไม่แสดง warning |
| sampleSize < 3 batches | ไม่แสดง z-score — แสดง "ข้อมูลไม่เพียงพอ" |
| External API error | log error, แจ้ง admin — ไม่กระทบ workflow หลัก |
| MongoDB query error | return `{ warning: false }` — degraded gracefully |

---

## 10. Implementation Phases

### Phase 1 — Smart Rules (2-3 สัปดาห์)

| งาน | ไฟล์ |
|-----|------|
| สร้าง `server/routes/ai.js` พร้อม outlier-check, machine-suggestions, daily-check-trends | ใหม่ |
| สร้าง `server/lib/smartRules.js` (z-score, linear regression) | ใหม่ |
| Mount `/api/ai` route ใน `server/index.js` | แก้ไข |
| Outlier warning UI ใน QC Testing | `src/pages/QCTestingDetailPage.tsx` |
| Copy-paste detection | `src/pages/QCTestingDetailPage.tsx` |
| Machine suggestion chips | `src/pages/PetitionAssignPage.tsx` |
| Sensor staleness badge | `src/pages/daily-check/EnvironmentCheckPage.tsx` |
| Consecutive failure banner | `src/pages/daily-check/BalanceRoomPage.tsx` |
| Approval smart sorting | `src/pages/QCApproval.tsx` |
| `AiWarningBadge` component | `src/components/lis/AiWarningBadge.tsx` |

### Phase 2 — Ollama Local LLM (1-2 สัปดาห์)

```powershell
# ติดตั้งบน Windows server
winget install Ollama.Ollama
ollama pull qwen2.5:7b
```

| งาน | ไฟล์ |
|-----|------|
| สร้าง `server/lib/ollamaClient.js` | ใหม่ |
| `/api/ai/draft-note` endpoint | `server/routes/ai.js` |
| `/api/ai/weekly-summary` endpoint | `server/routes/ai.js` |
| Draft note UI ใน QC Approval | `src/pages/QCApproval.tsx` |
| Weekly summary button | `src/pages/daily-check/DailyCheckRecordsPage.tsx` |

### Phase 3 — External API (เมื่อพร้อม)

| งาน | ไฟล์ |
|-----|------|
| `/api/ai/monthly-report` endpoint | `server/routes/ai.js` |
| Monthly report UI | `src/pages/Report.tsx` (หน้าที่มีอยู่แล้ว) หรือหน้าใหม่ |
| Anonymization layer | `server/lib/anonymize.js` |

---

## 11. Testing

```
Phase 1 — Unit tests (Vitest / Jest):
  server/routes/ai.test.js
  ├─ outlier-check: ค่าในช่วงปกติ → warning: false
  ├─ outlier-check: ค่า 4σ → warning: true, zScore ≈ 4.0
  ├─ outlier-check: sampleSize < 3 → reason: "insufficient_data"
  ├─ machine-suggestions: return top 3 sorted by usageCount desc
  └─ daily-check-trends: slope calculation ถูกต้อง (known dataset)

Phase 2 — Manual testing:
  ├─ Ollama offline → ปุ่ม draft ซ่อน, ไม่ crash
  ├─ Draft note ภาษาไทยอ่านรู้เรื่อง
  └─ Streaming response แสดงได้ (ไม่ timeout)

Non-regression ทุก phase:
  ├─ QC testing เดิมทำงานได้ปกติ (AI warning ไม่ block save)
  ├─ Petition workflow ไม่มีการเปลี่ยนแปลง logic หลัก
  └─ Performance: outlier-check < 200ms, machine-suggestions < 300ms
```

---

## 12. Success Criteria

| Metric | เป้าหมาย |
|--------|---------|
| Outlier detection latency | < 200ms |
| Machine suggestion accuracy | ≥ 70% ตรงกับที่ user เลือก |
| Ollama draft note quality | ผู้ใช้แก้ < 20% ของ draft |
| Zero regression | งานเดิมทำได้ปกติ 100% |
| Ollama offline resilience | ปุ่มซ่อน, ไม่มี error console |
