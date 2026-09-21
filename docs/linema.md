# การส่ง LINE ผ่าน Linema

การแจ้งเตือนและปุ่มทดสอบ LINE ใช้ `POST /Linema/api/v1/messages` พร้อม
`Authorization: Bearer <LINEMA_API_KEY>` และ JSON `{ to, messages }` ฝั่ง server เท่านั้น
ไม่ใช้ LINE channel token เป็นทางสำรองเมื่อส่งไม่สำเร็จ

## ตั้งค่า

เพิ่มใน `server/.env` ซึ่ง backend โหลดโดยตรง ไม่ใช่ `.env` ที่ root และไม่ใช้ตัวแปร `VITE_*`:

```dotenv
LINE_PUSH_URL=https://app-plant.icpladda.com/Linema
LINEMA_BASE_URL=https://app-plant.icpladda.com/Linema
LINEMA_API_KEY=
LINEMA_WEBHOOK_SECRET=
LINEMA_APP_SLUG=LIS
```

- ขอ API key ของแอป LIS จาก Linema แท็บ **แอป / คีย์** แล้วใส่ใน `LINEMA_API_KEY` เฉพาะ server
  รูปแบบ key คือ `lin_` ตามด้วย hex 40 ตัว ห้าม commit `.env` หรือ key จริง
- เปิด scope `messages:send` และผูกแอปกับแชทปลายทางในแท็บ **การกำหนดเส้นทาง**
  การผูกกลุ่มใน LIS อย่างเดียวไม่ได้ให้สิทธิ์ส่งใน Linema
- ใช้ `LINEMA_BASE_URL` ก่อน ถ้าว่างจึงใช้ `LINE_PUSH_URL` รองรับ URL ของ Linema ทั้งแบบ root
  และลงท้าย `/api/v1` รวมถึง trailing slash โดยไม่เติม `/api/v1` ซ้ำ
- URL ต้องเป็น HTTPS ไม่มี username/password, query หรือ fragment; ไม่ตาม HTTP redirect
- key ว่างหรือรูปแบบไม่ถูกต้อง หรือ URL ไม่ถูกต้อง: งดส่ง และแสดงว่ายังไม่ตั้งค่า
- รีสตาร์ท backend หลังแก้ env; การตรวจสอบในงานนี้ไม่ได้รีสตาร์ทบริการหรือส่งข้อความจริง

## ผลการส่ง

- `201` จาก Linema ถือว่าส่งสำเร็จ; `401`, `403`, `429`, `5xx` และ network error ถือว่าล้มเหลว
- `403` ให้ตรวจทั้ง scope `messages:send` และ routing ของแอปกับแชท
- ไม่มี retry อัตโนมัติหรือ fallback ไป LINE โดยตรง เพื่อลดความเสี่ยงส่งข้อความซ้ำ
- `/line/test` นับเฉพาะกลุ่มที่ส่งสำเร็จ หากมีรายการล้มเหลวจะตอบ `502` หรือ `503`
  เมื่อยังไม่ตั้งค่า พร้อมจำนวนที่สำเร็จและรายละเอียด ไม่แจ้งว่าสำเร็จทั้งที่ส่งไม่ได้
- สถานะตั้งค่าในหน้า Settings ตรวจเฉพาะ env ไม่ได้ยืนยันว่า key ใช้งานได้หรือ routing ถูกต้อง

## ขอบเขตที่ยังคงเดิม

`LINEMA_WEBHOOK_SECRET` และ `LINEMA_APP_SLUG` เตรียมไว้ใน env แต่ยังไม่ใช้ใน push request
เพราะสัญญา API ที่ได้รับระบุการยืนยันตัวตนด้วย key เท่านั้น
ยังไม่เปลี่ยน webhook, ingest, forwarding หรือ reply เดิม และไม่ลบค่า `LINE_CHANNEL_*`,
`LINE_INGEST_SECRET`, `LINE_FORWARD_WEBHOOK_URL` ที่ส่วนเดิมยังใช้อยู่
การย้ายส่วนรับข้อความและตอบกลับต้องมีเอกสาร endpoint/payload/header/ลายเซ็นของ Linema เพิ่มเติม

## ทดสอบโดยไม่ส่ง LINE จริง

```powershell
node --test server/lib/line.test.js server/lib/lineNotify.test.js server/routes/line.test.js
```
