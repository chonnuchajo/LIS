# ค่า ถ.พ. บนใบคำขอรับบริการ ← ค่าที่ QC ใส่ + lab เลือก

**Date:** 2026-06-13
**Status:** Approved (design)

## Problem

คอลัมน์ "ค่า ถ.พ." บนใบคำขอรับบริการ (`PetitionPrintTemplate`, หน้า 2) ดึงค่าจาก
`petition.reviewHistory[].specificGravities[]` ซึ่ง **ไม่มี frontend ตัวไหนเขียนค่าลงไป** →
คอลัมน์ว่างเสมอ

ค่า ถ.พ. จริงถูก QC วัดและกรอกในพารามิเตอร์ QC ชื่อ **"ค่า ถพ."**
(`scope: qc`, `shareWithLab: true`, field label `"ค่าถพ."` หน่วย g/cm³)
เก็บใน `QCTestResult.values["ค่าถพ."]` ต่อ `itemSeq`

เมื่อ ถพ. ถูกวัดหลายค่า (multi-entry → `QCTestResult.entries[]`) ฝั่ง **Lab เป็นผู้เลือก**
ว่าจะใช้ค่าไหนลงในฟอร์ม

## Goal

1. คอลัมน์ "ค่า ถ.พ." แสดงค่าที่ QC กรอกจริง (ตาม `itemSeq`)
2. ถ้ามีหลายค่า → Lab เลือกแถวที่จะใช้ ที่**หน้าการทดสอบ Lab** ค่าที่เลือกไปแสดงบนฟอร์ม
3. ไม่แก้ schema / ไม่แก้ backend (ใช้ save path ที่มีอยู่)

## Design

### 1. ระบุพารามิเตอร์ ถพ.
Match พารามิเตอร์ที่ `scope === 'qc' && shareWithLab` และมี `valueFields` ที่ label เป็น `"ค่าถพ."`
(ไม่ผูก `_id` ตายตัว) — helper กลางคืน `{ parameterId, fieldLabel }` ของพารามิเตอร์ ถพ.
> หมายเหตุ: ถ้าอนาคตต้องการความทนทานต่อการเปลี่ยนชื่อ ค่อยเพิ่ม flag บน Parameter
> (เช่น `isFormSpecificGravity`) — นอกขอบเขตรอบนี้

### 2. ตัวเลือกที่หน้าทดสอบ Lab (`LabTestingDetailPage.tsx`)
- ส่วนแสดงพารามิเตอร์ QC ที่ share ให้ lab (read-only, ~บรรทัด 1241–1390)
- ถ้าพารามิเตอร์ ถพ. เป็น `multiEntry` และมี > 1 entry → แสดง picker (radio/dropdown)
  "ใช้ค่านี้บนฟอร์ม" ต่อแถว ; highlight แถวที่เลือก
- บันทึกดัชนีที่เลือกเป็น sibling field ใน `QCTestResult.values` คีย์ **`"__formEntryIndex"`**
  ผ่าน `handleFieldChange` → `api.saveQCResult` (debounced) ที่มีอยู่ — ไม่ต้องแก้ schema
- ถ้ามี entry เดียว / ไม่ใช่ multiEntry → ไม่ต้องแสดง picker

### 3. ฟอร์มอ่านค่า (`PetitionDetailPage.tsx` + `PetitionPrintTemplate.tsx`)
- `PetitionDetailPage` ดึง `api.getQCResults(petitionId)` แล้วส่ง prop `qcResults` เข้า `PetitionPrintTemplate`
- เขียน `findSpecificGravity(qcResults, seq)` ใหม่:
  1. หา QCTestResult ที่ `itemSeq === seq` และเป็นพารามิเตอร์ ถพ.
  2. เลือกแถว: ถ้า multiEntry → ใช้ `values["__formEntryIndex"]` (default 0 ถ้าไม่มี) อ่านจาก `entries[idx]["ค่าถพ."]`
     ; ถ้า scalar → `values["ค่าถพ."]`
  3. คืน string (ว่างถ้าไม่พบ)
- ลบ path เดิมที่อ่าน `reviewHistory.specificGravities`

## Components / Units

- `src/lib/formSpecificGravity.ts` (ใหม่) — pure helpers:
  - `findSgParameter(parameters)` → `{ parameterId, fieldLabel } | null`
  - `resolveSpecificGravity(qcResults, seq, sgParam)` → `string`
  - มี `formSpecificGravity.test.ts` (Vitest) ครอบ: scalar / multiEntry มี index / ไม่มี index / ไม่พบ
- `LabTestingDetailPage.tsx` — เพิ่ม picker UI + persist `__formEntryIndex`
- `PetitionPrintTemplate.tsx` — รับ prop `qcResults`, ใช้ helper
- `PetitionDetailPage.tsx` — fetch + ส่ง prop

## Error / Edge cases
- ไม่มีพารามิเตอร์ ถพ. ในระบบ → คอลัมน์ว่าง (ไม่ error)
- มี entry แต่ `__formEntryIndex` ชี้เกินขอบเขต → clamp เป็น 0
- ค่าที่เก็บอาจเป็น number/string → แปลงเป็น string เสมอ

## Testing
- Vitest หน่วยสำหรับ `formSpecificGravity.ts` (ครอบ edge cases ข้างบน)
- Manual: หน้าทดสอบ Lab เลือกค่า → พรีวิวฟอร์มเห็นค่าที่เลือก

## Out of scope
- ไม่ทำ flag บน Parameter
- ไม่ย้าย/แก้โครงสร้าง backend หรือ schema
- ไม่แตะ RealtimeDensity
