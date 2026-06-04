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
// DEMO: boardId = slug ชั่วคราว → Node-RED ยิง { board: "balance", ... } แล้วห้องติดเลย
//       ใช้งานจริงให้เปลี่ยน boardId เป็นชื่อ device จริงของแต่ละห้อง (แก้บรรทัดเดียว/ห้อง)
export const ENV_ROOMS: EnvRoom[] = [
  { slug: "balance",     label: "ห้องชั่งสาร",       boardId: "balance",     tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "sample-prep", label: "ห้องเตรียมตัวอย่าง", boardId: "sample-prep", tempMin: 15, tempMax: 25, humidityMax: 70 },
  { slug: "analysis",    label: "ห้องวิเคราะห์",      boardId: "analysis",    tempMin: 15, tempMax: 25, humidityMax: 70 },
];

export const getEnvRoom = (slug: string): EnvRoom | undefined =>
  ENV_ROOMS.find((r) => r.slug === slug);

/**
 * A live reading from Node-RED is pushed roughly every minute. If we haven't
 * seen one for this long the sensor is likely down — flag it so the user knows
 * the pre-filled value may be outdated rather than trusting a stuck number.
 */
export const STALE_AFTER_MS = 3 * 60 * 1000; // 3 minutes

/** True if a reading's receivedAt is missing/unparseable or older than STALE_AFTER_MS. */
export const isReadingStale = (receivedAt: string | undefined, now: number): boolean => {
  if (!receivedAt) return true;
  const t = new Date(receivedAt).getTime();
  if (isNaN(t)) return true;
  return now - t > STALE_AFTER_MS;
};

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

/** DB-stored per-room override. `label` is not stored — it comes from ENV_ROOMS. */
export type EnvRoomConfig = {
  slug: EnvRoom["slug"];
  boardId: string;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
};

/** Editable subset used by the Settings form / PUT body. */
export type EnvRoomConfigInput = {
  boardId: string;
  tempMin: number;
  tempMax: number;
  humidityMax: number;
};

export type EnvRoomConfigErrorField = "boardId" | "tempMin" | "tempMax" | "humidityMax";
export type EnvRoomConfigError = { field: EnvRoomConfigErrorField; message: string } | null;

/** Validate a config draft. Mirrors the server-side checks in routes/envRoomConfig.js. */
export const validateEnvRoomConfig = (input: {
  boardId?: unknown;
  tempMin?: unknown;
  tempMax?: unknown;
  humidityMax?: unknown;
}): EnvRoomConfigError => {
  const fields: [EnvRoomConfigErrorField, unknown][] = [
    ["tempMin", input.tempMin],
    ["tempMax", input.tempMax],
    ["humidityMax", input.humidityMax],
  ];
  for (const [field, v] of fields) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return { field, message: "ต้องเป็นตัวเลข" };
    }
  }
  if ((input.tempMin as number) > (input.tempMax as number)) {
    return { field: "tempMin", message: "อุณหภูมิต่ำสุดต้องไม่เกินสูงสุด" };
  }
  if ((input.humidityMax as number) <= 0) {
    return { field: "humidityMax", message: "ความชื้นสูงสุดต้องมากกว่า 0" };
  }
  return null;
};

/** Overlay DB configs onto code defaults by slug, preserving label + any other default fields. */
export const mergeEnvRooms = (defaults: EnvRoom[], configs: EnvRoomConfig[]): EnvRoom[] => {
  const bySlug = new Map(configs.map((c) => [c.slug, c]));
  return defaults.map((d) => {
    const c = bySlug.get(d.slug);
    return c
      ? { ...d, boardId: c.boardId, tempMin: c.tempMin, tempMax: c.tempMax, humidityMax: c.humidityMax }
      : d;
  });
};
