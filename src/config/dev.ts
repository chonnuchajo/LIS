// DEV MODE: เปลี่ยนเป็น true เพื่อข้าม Microsoft login ตอน development
// ห้ามเปิดใน production
export const DEV_MODE = true;

export const DEV_USER = {
  id: "dev-user-001",
  email: "dev@icpladda.com",
  name: "Dev User (DEV MODE)",
  role: "admin",
  permissions: [] as string[],
  department: "IT",
  position: "Developer",
  status: "active" as const,
};
