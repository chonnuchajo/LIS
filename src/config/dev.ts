// DEV MODE: true อัตโนมัติตอน `npm run dev`, false ตอน `npm run build` (production)
// ผูกกับ Vite build mode — ไม่ต้องแก้มือ กันลืม push ค่า true ขึ้น production
export const DEV_MODE = import.meta.env.DEV;

// Role ที่ใช้เป็นค่าเริ่มต้นเมื่อยังไม่เคยเลือก
export const DEV_DEFAULT_ROLE = "admin";

export const DEV_USERS: Record<string, {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  department: string;
  position: string;
  status: "active" | "inactive";
}> = {
  admin: {
    id: "dev-user-admin",
    email: "dev.admin@icpladda.com",
    name: "Dev Admin",
    role: "admin",
    permissions: [],
    department: "IT",
    position: "System Admin",
    status: "active",
  },
  lab: {
    id: "dev-user-lab",
    email: "dev.lab@icpladda.com",
    name: "Dev Lab Tech",
    role: "lab",
    permissions: [],
    department: "Laboratory",
    position: "Lab Technician",
    status: "active",
  },
  qc: {
    id: "dev-user-qc",
    email: "dev.qc@icpladda.com",
    name: "Dev QC Officer",
    role: "qc",
    permissions: [],
    department: "QC",
    position: "QC Officer",
    status: "active",
  },
  viewer: {
    id: "dev-user-viewer",
    email: "dev.viewer@icpladda.com",
    name: "Dev Viewer",
    role: "viewer",
    permissions: [],
    department: "Management",
    position: "Manager",
    status: "active",
  },
};
