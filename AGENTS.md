# ข้อตกลงสำหรับ AI ทุกค่าย

## ข้อตกลงห้ามรัน Build

- ห้าม run `npm run build`, `npm run build:dev`, `npm run build:watch`, `vite build` หรือคำสั่ง build ที่เทียบเท่า เว้นแต่ผู้ใช้จะสั่งให้ build อย่างชัดเจนในบทสนทนาปัจจุบัน
- ห้าม run script ที่ไป trigger build หรือ workflow `postbuild` ทางอ้อม เว้นแต่ได้รับอนุญาตจากผู้ใช้อย่างชัดเจน
- สำหรับการตรวจสอบทั่วไป ให้ใช้ `npx tsc --noEmit`, `npm run test`, `npm run lint` หรือคำสั่ง test แบบเจาะจงแทน
- Build flow ของ repository นี้จะเขียนทับไฟล์ production ที่ root เช่น `app.html` และ `assets/` ดังนั้นการ build โดยไม่ได้รับคำสั่งอาจรบกวน working tree และสถานะ deployment ได้

## ข้อตกลงการซิ้ง Branch ประจำวัน

- ก่อนเริ่มงานในแต่ละวัน ถ้า branch ปัจจุบันไม่ใช่ `main` หรือ `develop` ให้ run `git pull origin main` ก่อนทุกครั้ง

## ข้อตกลงการวางแผนงาน

- ทุกครั้งที่ทำแผนงานหรือรายการ TODO ให้เขียนเป็นภาษาไทย

## ข้อตกลงการ Commit

- เมื่อมีการ commit งานที่ทำเสร็จ ให้เขียน commit message เป็นภาษาไทยทุกครั้ง

## ข้อตกลงการทำ Feature

- ทุกครั้งที่ทำ feature ให้ทำบน branch ปัจจุบัน โดยไม่ต้องถามก่อน
