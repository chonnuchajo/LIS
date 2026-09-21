import { z } from "zod";
const resultSchema = z.object({
  summary: z.string().max(5000), warnings: z.array(z.string().max(2000)).max(40),
  rows: z.array(z.array(z.string().max(1000).refine(cell => !/[\t\r\n]/.test(cell))).max(30)).max(150),
});
export type ValidationAiResult = z.infer<typeof resultSchema>;
export async function requestValidationAi(input: { mode: "review" | "extract"; text?: string; image?: string }, signal: AbortSignal): Promise<ValidationAiResult> {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const response = await fetch(`${base}/api/validation-ai`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("กรุณาเข้าสู่ระบบ LIS ก่อนใช้ AI");
    if (response.status === 429) throw new Error("มีคำขอ AI มาก กรุณารอสักครู่แล้วลองใหม่");
    throw new Error("AI ยังไม่พร้อมหรืออ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่หรือตรวจการตั้งค่า server");
  }
  const parsed = resultSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("ผล AI ไม่สมบูรณ์ กรุณาลองใหม่หรือกรอกข้อมูลเอง");
  return parsed.data;
}
