type DevUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  department: string;
  position: string;
  status: "active" | "inactive";
};

const ALL_PERMISSIONS = [
  "dashboard",
  "samples",
  "results",
  "qc",
  "stock",
  "reports",
  "admin",
  "access",
  "others",
];

export const DEV_MODE =
  import.meta.env.MODE === "development" &&
  import.meta.env.VITE_DEV_MODE !== "false";

export const DEV_DEFAULT_ROLE = "admin";

export const DEV_USERS: Record<string, DevUser> = {
  admin: {
    id: "dev-admin",
    email: "admin.dev@example.local",
    name: "Dev Admin",
    role: "admin",
    permissions: ALL_PERMISSIONS,
    department: "Development",
    position: "Administrator",
    status: "active",
  },
  lab: {
    id: "dev-lab",
    email: "lab.dev@example.local",
    name: "Dev Lab",
    role: "lab",
    permissions: ["dashboard", "samples", "results", "stock"],
    department: "Laboratory",
    position: "Lab Analyst",
    status: "active",
  },
  qc: {
    id: "dev-qc",
    email: "qc.dev@example.local",
    name: "Dev QC",
    role: "qc",
    permissions: ["dashboard", "results", "qc", "reports"],
    department: "Quality Control",
    position: "QC Reviewer",
    status: "active",
  },
  viewer: {
    id: "dev-viewer",
    email: "viewer.dev@example.local",
    name: "Dev Viewer",
    role: "viewer",
    permissions: ["dashboard", "reports"],
    department: "Operations",
    position: "Viewer",
    status: "active",
  },
};
