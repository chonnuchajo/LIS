# แผนขอตัวอย่างเพิ่มและแยกรอบนำส่ง

## เป้าหมายและแบบที่ใช้
หลัง QC หรือ LAB รับตัวอย่างและบันทึกค่าที่ไม่ผ่าน ผู้ตรวจเลือกขอตัวอย่างเพิ่มจาก popup ระบุรายการ จำนวน และเหตุผล ระบบแจ้งผู้ยื่น/ฝ่ายผู้ยื่น ผู้ยื่นพิมพ์ใบนำส่งเพิ่มพร้อม QR เฉพาะรอบ แล้วฝ่ายที่ขอสแกนรับและตรวจต่อ

ใช้คำขอเดิม เก็บรอบเพิ่มใน Petition.additionalSampleRequests ไม่เปิดคำขอใหม่ ไม่ล้างงานอีกฝั่ง เก็บสำเนาผลก่อนขอเพิ่ม ป้องกันการปิด Final Result ขณะรอรับ และห้ามใช้ผลก่อนรอบเพิ่มยืนยันผลใหม่

## ข้อกำหนดร่วม
- ใช้ branch ปัจจุบัน ไม่ build ไม่ push; commit เฉพาะ source หลังตรวจสอบ
- หน้าจอใช้ภาษาไทยและ component ตาม design.md
- QR รอบเดิมยังดูประวัติได้ แต่รับแทนรอบใหม่ไม่ได้; สแกนซ้ำหรือผิดฝั่งต้องไม่แก้ข้อมูล
- ตรวจสิทธิ์จากบัญชีใน DB ตามรูปแบบ session / X-LIS-User ที่ระบบใช้อยู่ ไม่เชื่อ role จาก body
- การแจ้งเตือนใช้ audit/bell และ LINE เดิม ไม่ส่งข้อความจริงระหว่างทดสอบ
- ไม่เพิ่ม dependency; ใช้ Node crypto, Mongoose, React และชุดทดสอบเดิม

## งานและหลักฐานรับมอบ
1. [x] เพิ่ม schema รอบนำส่งและกฎสถานะ พร้อม tests การตรวจข้อมูล สิทธิ์ รอบค้าง การรับซ้ำและการรักษาผลเดิม
2. [x] เพิ่ม API ขอเพิ่ม/สแกน/นำส่ง/รับ และกันการข้ามรอบใน complete, approve, review, update รวมถึงการบันทึกผลระหว่างรอ
3. [x] แจ้งเตือนฝ่ายผู้ขอให้ถูกต้อง รวม R&D และ FG โดยอ้างอิงผู้ยื่น ไม่เหมารวม dept=production
4. [x] เพิ่ม popup ที่ QC/LAB เมื่อพบค่าผิดปกติ และรายการรอรับให้ไม่สามารถยืนยันผลเดิมเป็นผลใหม่
5. [x] เพิ่มรายการรอบในหน้าคำขอ ปุ่มพิมพ์ใบนำส่งเพิ่มและฉลาก QR ใหม่ พร้อมเชื่อมหน้าสแกนทั้งสองฝั่ง
6. [x] ตรวจ tests เฉพาะจุด, TypeScript noEmit, lint เฉพาะไฟล์ และ QA หน้าจอ/งานพิมพ์โดยไม่ build

## ขอบเขตข้อมูล
แต่ละรอบประกอบด้วย _id, qrCode, side, reason, items (itemSeq, quantity), requestedBy/At, sentBy/At, receivedBy/At, status และ previousResults สำหรับสำเนาผลเดิม

API ขอเพิ่มรับ side, reason, items; server ตรวจว่าฝั่งนั้นรับแล้ว มีผลผิดปกติที่บันทึกจริง และไม่มีรอบค้างฝั่งเดียวกัน การสแกนคืนคำขอพร้อม scannedAdditionalSampleId เพื่อผูกการนำส่ง/รับกับรอบนั้น ไม่ใช้สถานะรวมแทนรอบ

ผลตรวจปัจจุบันมี sampleRoundId ซึ่ง server กำหนดเองจากรอบล่าสุดที่รับแล้ว เฉพาะรายการ/ฝั่งที่ขอเพิ่ม หน้า QC/LAB ไม่โหลดค่ารอบเก่ามาเป็นค่ารอบใหม่

## ข้อจำกัดที่พบก่อนเริ่ม
- การ sync git pull --ff-only origin aekuma ทำไม่ได้เพราะประวัติ branch แยกกัน; ไม่ merge/rebase งานอื่น
- การยืนยันตัวตนแบบ Microsoft เดิมยังพึ่ง X-LIS-User; feature นี้ไม่ขยายความน่าเชื่อถือของ header เดิม
- ชุดทดสอบเดิมมีข้อผิดพลาดข้อความคาดหวังและ import บางส่วนจากการตรวจ flow ก่อนหน้า ต้องแยกจากผล tests feature นี้

## หลักฐานตรวจรับ 21 กันยายน 2026
- ตรวจซ้ำหลังงาน search commit 8b06386b บน develop; แยกเฉพาะไฟล์ตัวอย่างเพิ่ม ไม่รวมงานอื่น
- Backend 113 tests ผ่าน: additionalSamples (helper/routes), petitionWriteQueue, phaseAdvance, lineNotify, petitionNotifications และ line routes
- Frontend 144 tests ผ่านใน 8 ไฟล์: popup, QC/LAB integration, round QR/scanners, print/history, requester audience และหน้า timeline
- ตรวจวงจร QC และ LAB: ผลไม่ผ่านที่บันทึกแล้ว ขอเพิ่ม เก็บสำเนาผลเดิม ออก QR ใหม่ ส่ง รับ ตรวจใหม่ ยืนยันผล และ Final Result; รวม wrong side, old/repeated QR, unauthorized caller, stale tabs และการบันทึกชนกับ snapshot
- Chromium แยกพร้อม API จำลอง: เปิด popup และส่งคำขอ QC/LAB จำนวน 2, lock ระหว่างรอ, QR สองรอบไม่ซ้ำ, เปิดพิมพ์จากเส้นทางแจ้งเตือนจริง /LIS/petition/:id; ไม่มี page errors
- Browser รอบแรกเกิน timeout โหลดหน้า 8 วินาที; รันสคริปต์เดิมซ้ำหลัง static checks จบแล้วผ่าน โดยไม่แก้ production code หรือผ่อน assertions
- ตรวจภาพ A4 และฉลากรอบใหม่ด้วย browser; ไม่ส่งพิมพ์จริง ไม่ส่ง LINE จริง และไม่เขียนข้อมูลทดสอบลง DB ใช้งาน
- TypeScript noEmit พบ 57 errors นอกไฟล์งานนี้; ไม่พบ error ในไฟล์ที่แก้สำหรับ feature นี้
- Scoped ESLint ไม่มี error, มี warning เดิม 3 จุด; syntax server 20 ไฟล์และ diff check ผ่าน
- Checklist design.md: ใช้ AppLayout/PageHeader เดิม, popup/Card/Button/Badge ไทยตามระบบ, ไม่มี padding ซ้ำ; สีดำ/ขาวและหน่วย mm จำกัดในเอกสารพิมพ์

## ขอบเขตการรันและข้อจำกัด
- MongoDB ปัจจุบันเป็น standalone (ตรวจ hello แบบอ่านอย่างเดียว); ไม่เปลี่ยน deployment ให้เป็น replica set
- การเก็บ snapshot กับผลตรวจเรียงต่อคำขอใน Node API process เดียว พร้อม revision guard และปฏิเสธผลจากรอบเก่า หากเปิด API หลาย process ต้องเพิ่มการประสานงานระดับ DB/transactions ก่อน
- timer/Phase 2 แยกในแต่ละรอบและฝ่าย ไม่ใช้เวลาปลดล็อกรอบเดิม และไม่เปลี่ยน phase ของอีกฝ่าย
- บัญชีและสิทธิ์ใช้ session / X-LIS-User แบบเดิม; ไม่อ้างว่าแก้ข้อจำกัดความปลอดภัยของ header ทั้งระบบ
- ไม่มี build, deploy หรือ push; source commit เฉพาะงานนี้ ไม่รวมการแก้ search/stock/access ที่เกิดพร้อมกัน
- ตรวจ sync อีกครั้ง 21 กันยายน: git pull --ff-only origin aekuma ยังทำไม่ได้เพราะประวัติแยกกัน; ไม่ merge/rebase
