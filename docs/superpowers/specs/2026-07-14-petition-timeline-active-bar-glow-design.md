# Petition Timeline — active bar glow

## Goal

แถว timeline ที่ยังดำเนินต่ออยู่ตอนนี้เป็นสีอ่อนและตัดปลายขวา ทำให้อ่านได้ว่า "ยังไม่จบ" แต่ยังไม่ให้ความรู้สึกว่างานกำลังเคลื่อนไปข้างหน้า ต้องเพิ่มเอฟเฟกต์เงาแสงและเส้นแสงวิ่งบนแท่ง active

## Scope

แก้เฉพาะหน้า `/petition-timeline/:id` ใน `src/pages/PetitionTimelineDetailPage.tsx` และเทสต์หน้าเดิม `src/pages/PetitionTimelineDetailPage.test.tsx`

ไม่เปลี่ยน `src/lib/petitionTimelineDetail.ts` เพราะ model ระบุ `row.kind`, `row.done`, `segmentStartAt`, `segmentEndAt`, และสถานะข้ามวันไว้พอแล้ว

## Behavior

- เฉพาะแถว `bar` ที่ `row.done === false` ได้เอฟเฟกต์ active
- แท่งที่จบแล้วคงหน้าตาเดิม
- สีหลักของแท่งยังมาจาก `timelineBarClass(row.key, ...)`
- active bar ได้ `shadow` เรืองแสงเบา ๆ และ overlay แบบ gradient ที่ขยับจากซ้ายไปขวาซ้ำ ๆ
- ยังคง `rounded-r-none` สำหรับงานที่ยังต่อไปข้างหน้า และ `rounded-l-none` สำหรับช่วงที่ต่อมาจากวันก่อน

## Implementation Notes

ใช้ CSS class literal ใน JSX เพื่อให้ Tailwind scan เจอ class ทั้งหมด ไม่เพิ่ม dependency และไม่เพิ่มไฟล์ global CSS ถ้าไม่จำเป็น

ใช้ pseudo-element หรือ child overlay ภายในแท่ง active โดยตั้ง `overflow-hidden` เพื่อไม่ให้แสงล้น track

## Verification

- เพิ่ม page test ที่ render แถว active แล้วตรวจว่า element ช่วงเวลามี class สำหรับ active glow/animation
- รันเฉพาะ `npx vitest run src/pages/PetitionTimelineDetailPage.test.tsx`
- ไม่รัน build ตาม no-build policy
