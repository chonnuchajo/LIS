// Types + audience metadata for the LINE group registry (server: models/LineGroup.js).
// Keep AUDIENCES in sync with server/models/LineGroup.js AUDIENCES.

export type LineAudience = "qc" | "lab" | "production" | "rm" | "fg" | "all";

export interface LineAudienceMeta {
  value: LineAudience;
  label: string;
  description: string;
}

// Order here drives the picker + list grouping.
export const LINE_AUDIENCES: LineAudienceMeta[] = [
  { value: "all", label: "ทุกเหตุการณ์ (รวม)", description: "รับทุก event ของทุกคำขอ — เหมาะกับกลุ่มรวม/แอดมิน" },
  { value: "qc", label: "QC", description: "คำขอใหม่ · มอบหมาย QC · ตรวจ QC · อนุมัติ/ปิดงาน" },
  { value: "lab", label: "Lab", description: "มอบหมาย Lab · บันทึกผล Lab · อนุมัติ Lab" },
  { value: "production", label: "แผนกผลิต", description: "แจ้งกลับผู้ยื่น (แผนกผลิต) เมื่อผลออก/ปิดงาน" },
  { value: "rm", label: "แผนก RM", description: "แจ้งกลับผู้ยื่น (วัตถุดิบ) เมื่อผลออก/ปิดงาน" },
  { value: "fg", label: "แผนก FG", description: "แจ้งกลับผู้ยื่น (สินค้าสำเร็จรูป) เมื่อผลออก/ปิดงาน" },
];

export const lineAudienceLabel = (value: string): string =>
  LINE_AUDIENCES.find((a) => a.value === value)?.label ?? value;

// Catalogue of the notifications the server pushes — mirrors describeEvent /
// audiencesForEvent in server/lib/lineNotify.js. Shown on the Settings LINE tab so
// admins can see exactly what each group receives. `audiences` = concrete recipients;
// `note` explains conditional routing (lab-item / assignee side / requester dept).
export interface LineNotificationInfo {
  emoji: string;
  title: string;
  audiences: LineAudience[];
  note?: string;
}

export const LINE_NOTIFICATIONS: LineNotificationInfo[] = [
  { emoji: "📋", title: "คำขอใหม่ถูกสร้าง", audiences: ["qc"] },
  {
    emoji: "👤",
    title: "มอบหมายงานให้เจ้าหน้าที่",
    audiences: [],
    note: "ส่งไปฝั่งที่รับผิดชอบ (QC หรือ Lab ตามผู้ถูกมอบหมาย)",
  },
  {
    emoji: "🚚",
    title: "ส่งตัวอย่างแล้ว — รอรับเข้าระบบ",
    audiences: ["qc"],
    note: "+ Lab เมื่อคำขอมีรายการฝั่ง Lab",
  },
  {
    emoji: "✅",
    title: "ตรวจครบทุกส่วน — รอหัวหน้า QC ยืนยัน",
    audiences: ["qc"],
    note: "+ Lab (ถ้ามีรายการ Lab) + แผนกผู้ยื่นคำขอ",
  },
  {
    emoji: "🎉",
    title: "หัวหน้า QC อนุมัติ — ปิดงาน",
    audiences: ["qc"],
    note: "+ แผนกผู้ยื่นคำขอ",
  },
  {
    emoji: "⛔",
    title: "ถูกส่งกลับให้แก้ไข",
    audiences: ["qc"],
    note: "+ Lab เมื่อคำขอมีรายการฝั่ง Lab",
  },
  {
    emoji: "📝",
    title: "บันทึกผล / อนุมัติรายฝั่ง (Lab หรือ QC)",
    audiences: [],
    note: "ส่งไปเฉพาะฝั่งที่บันทึกผล (Lab หรือ QC)",
  },
];

// What an end-user can type to the bot — mirrors parseCommand in server/routes/line.js.
// Shown on the Settings LINE tab so admins know what to tell users.
export interface LineBotCommand {
  example: string;
  desc: string;
}

export const LINE_BOT_COMMANDS: LineBotCommand[] = [
  { example: "P-2606-0018", desc: "ดูสถานะคำขอตามเลข (พิมพ์ในประโยคก็ได้)" },
  { example: "batch 326", desc: "ค้นหาคำขอตามเลข batch หรือ lot" },
  { example: "งานค้าง", desc: "สรุปงานที่ยังไม่เสร็จ + รายการล่าสุด" },
  { example: "งานวันนี้", desc: "สรุปคำขอเข้าใหม่ / ตรวจเสร็จวันนี้" },
  { example: "/ถาม <คำถาม>", desc: "ถามผู้ช่วย AI แบบภาษาธรรมชาติ (อ้างอิงข้อมูลระบบจริง)" },
  { example: "/help", desc: "ดูคำสั่งทั้งหมด" },
];

export interface LineGroup {
  _id: string;
  groupId: string;
  audience: LineAudience;
  name?: string;
  enabled: boolean;
  boundBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LineHealth {
  configured: boolean; // LINE_CHANNEL_ACCESS_TOKEN present
  hasSecret: boolean; // LINE_CHANNEL_SECRET present (needed for webhook/bot)
  groupCount: number; // enabled groups
  forwarding: boolean; // LINE_FORWARD_WEBHOOK_URL set — inbound events relayed downstream
  forwardUrl: string | null;
  ingest: boolean; // /line/ingest ready (LINE→n8n→LIS topology)
}

export interface LineGroupInput {
  groupId: string;
  audience: LineAudience;
  name?: string;
}
