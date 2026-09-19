# LIS Design Guide

เอกสารนี้เป็นกฎดีไซน์กลางของ LIS ทุกครั้งที่ AI หรือ agent จะแก้ไฟล์ใน repository นี้ ต้องอ่านไฟล์นี้ก่อนเริ่มงาน และต้องตรวจว่า change ที่ทำไม่ทำให้หน้าตาระบบหลุดมาตรฐานกลาง

## หลักการรวม

- ใช้โครงหน้าเดียวกันผ่าน `AppLayout` และ `PageHeader` สำหรับหน้าหลัง Login ทุกหน้า
- ไม่ใส่ padding ซ้ำใน page root เพราะ `AppLayout` มี `p-4 sm:p-6` อยู่แล้ว
- Page root ให้เริ่มด้วย `space-y-4` หรือ `space-y-6` ตามความหนาแน่นของข้อมูล
- ใช้ภาษา UI เป็นภาษาไทย ยกเว้นชื่อเอกสาร ระบบ หรือคำย่อที่ผู้ใช้คุ้น เช่น `COA`, `PDF`, `QC Head`

## สีและ Token

- ใช้ token กลางเป็นหลัก: `background`, `foreground`, `muted`, `muted-foreground`, `card`, `card-foreground`, `border`, `primary`, `secondary`, `accent`, `destructive`
- ถ้าต้องใช้สีแบรนด์ ให้ใช้ `primary-*` หรือ `lis.*` จาก `tailwind.config.ts`
- ห้ามสร้างธีมเฉพาะหน้าด้วยสี hardcode เช่น `bg-sky-50`, `text-sky-950`, `border-sky-100`, `bg-white/90` เว้นแต่มีเหตุผลด้านสถานะหรือเอกสารเฉพาะและต้องคุมให้ไม่หลุดทั้งหน้า
- สีสถานะใช้แบบ semantic เท่านั้น: เขียวสำหรับผ่าน/เสร็จ, เหลืองสำหรับรอ/เตือน, แดงสำหรับผิดพลาด/ไม่อนุมัติ, น้ำเงิน primary สำหรับ action หลัก

## Layout และ Component

- ใช้ `Card` หรือ pattern `rounded-lg border bg-card text-card-foreground shadow-sm` สำหรับกล่องเนื้อหา
- ใช้ `Button` variants (`default`, `outline`, `destructive`, `secondary`, `ghost`) ก่อนเขียน class สีเอง
- ใช้ `Badge` variants ที่มีอยู่ก่อนสร้าง badge style ใหม่
- ใช้ `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` เมื่อเป็น tab ปกติ; ถ้าต้องทำ segmented filter เอง ให้ใช้ spacing และ radius มาตรฐาน
- ห้ามใช้ระยะตายตัวแบบ `cm`, pixel ใหญ่ หรือ arbitrary spacing เช่น `gap-x-[5cm]` ใน UI หลัก; ใช้ Tailwind spacing scale เช่น `gap-2`, `gap-3`, `gap-4`
- ตารางควรอยู่ใน `rounded-lg border bg-card shadow-sm`, header ใช้ `bg-muted text-muted-foreground`, body ใช้ `divide-y`, row hover ใช้ `hover:bg-accent`

## Typography

- หัวหน้าใช้ `PageHeader` และปล่อยให้ component คุมขนาดตัวอักษร
- หัวข้อ section ใช้ `text-base font-semibold text-foreground`
- ข้อความรองใช้ `text-sm text-muted-foreground`
- หลีกเลี่ยงการใช้สีเพื่อเน้นข้อความทั่วไป ให้ใช้ weight/spacing ก่อน

## COA Pages

- หน้า `COA` ต้องใช้ดีไซน์เดียวกับหน้าอื่นของระบบ ไม่ใช้พื้นหลังสีเฉพาะหน้า
- หน้า `COA` ใช้ `primary` สำหรับ action หลัก เช่น สร้าง/อนุมัติ/พิมพ์
- ข้อมูล trend, folder, filter, table ต้องอยู่ใน card/panel มาตรฐานเดียวกับระบบ
- printable template ของ COA แยกได้ตามข้อกำหนดเอกสาร แต่หน้า management และ detail ต้องคุมให้เข้ากับ LIS app shell

## Checklist ก่อนจบงาน UI

- อ่าน `design.md` แล้ว
- ตรวจว่าไม่มี padding ซ้ำจาก `AppLayout`
- ตรวจว่า page root ใช้ spacing มาตรฐาน
- ตรวจว่าไม่มีสี hardcode เฉพาะหน้าโดยไม่จำเป็น
- ตรวจว่า button, badge, card, table ใช้ component หรือ token กลาง
- ตรวจ responsive ด้วยการไม่ใช้ระยะตายตัวแบบ `cm` หรือ width fixed โดยไม่จำเป็น
