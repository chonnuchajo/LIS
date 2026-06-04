export type EnvStatus = "pass" | "fail";

export interface EnvRoom {
  /** slug matching the daily-check room */
  slug: "balance" | "sample-prep" | "analysis";
  /** Thai room name shown on the env page */
  label: string;
  /** Node-RED board id that monitors this room. "" = unmapped → manual entry only. */
  boardId: string;
  tempMin: number;     // °C inclusive lower bound
  tempMax: number;     // °C inclusive upper bound
  humidityMax: number; // %RH inclusive upper bound
}

// ปรับ boardId ให้ตรงบอร์ดจริง และปรับเกณฑ์ได้ที่นี่ไฟล์เดียว
export const ENV_ROOMS: EnvRoom[] = [
  { slug: "balance",     label: "ห้องชั่งสาร",       boardId: "", tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "sample-prep", label: "ห้องเตรียมตัวอย่าง", boardId: "", tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "analysis",    label: "ห้องวิเคราะห์",      boardId: "", tempMin: 15, tempMax: 25, humidityMax: 70 },
];

export const getEnvRoom = (slug: string): EnvRoom | undefined =>
  ENV_ROOMS.find((r) => r.slug === slug);

export interface EnvEvaluation {
  tempStatus: EnvStatus;
  humidityStatus: EnvStatus;
  status: EnvStatus;
}

export const evaluateEnv = (
  temperature: number,
  humidity: number,
  room: Pick<EnvRoom, "tempMin" | "tempMax" | "humidityMax">,
): EnvEvaluation => {
  const tempStatus: EnvStatus =
    temperature >= room.tempMin && temperature <= room.tempMax ? "pass" : "fail";
  const humidityStatus: EnvStatus = humidity <= room.humidityMax ? "pass" : "fail";
  const status: EnvStatus =
    tempStatus === "pass" && humidityStatus === "pass" ? "pass" : "fail";
  return { tempStatus, humidityStatus, status };
};
