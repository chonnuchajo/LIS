<<<<<<< HEAD
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
=======
// Dev mode bypasses Microsoft login and injects a hardcoded user.
// MUST be false before any production deployment.
export const DEV_MODE = false;

export const DEV_DEFAULT_ROLE = "admin";

type DevUser = {
  id?: string;
  email: string;
  name?: string;
  role?: string;
  permissions?: string[];
  department?: string;
  position?: string;
  status?: "active" | "inactive";
};

export const DEV_USERS: Record<string, DevUser> = {
  admin: {
    id: "dev-admin",
    email: "dev@icpladda.com",
    name: "Dev Admin",
    role: "admin",
    permissions: [],
    department: "IT",
>>>>>>> 19b750d77a95e65beb5d81b5dadfabc86fcf7d43
    position: "Administrator",
    status: "active",
  },
  lab: {
    id: "dev-lab",
<<<<<<< HEAD
    email: "lab.dev@example.local",
    name: "Dev Lab",
    role: "lab",
    permissions: ["dashboard", "samples", "results", "stock"],
    department: "Laboratory",
    position: "Lab Analyst",
=======
    email: "lab.dev@icpladda.com",
    name: "Dev Lab",
    role: "lab",
    permissions: [],
    department: "Lab",
    position: "Lab Technician",
>>>>>>> 19b750d77a95e65beb5d81b5dadfabc86fcf7d43
    status: "active",
  },
  qc: {
    id: "dev-qc",
<<<<<<< HEAD
    email: "qc.dev@example.local",
    name: "Dev QC",
    role: "qc",
    permissions: ["dashboard", "results", "qc", "reports"],
    department: "Quality Control",
    position: "QC Reviewer",
=======
    email: "qc.dev@icpladda.com",
    name: "Dev QC",
    role: "qc",
    permissions: [],
    department: "QC",
    position: "QC Officer",
>>>>>>> 19b750d77a95e65beb5d81b5dadfabc86fcf7d43
    status: "active",
  },
  viewer: {
    id: "dev-viewer",
<<<<<<< HEAD
    email: "viewer.dev@example.local",
    name: "Dev Viewer",
    role: "viewer",
    permissions: ["dashboard", "reports"],
    department: "Operations",
=======
    email: "viewer.dev@icpladda.com",
    name: "Dev Viewer",
    role: "viewer",
    permissions: [],
    department: "Office",
>>>>>>> 19b750d77a95e65beb5d81b5dadfabc86fcf7d43
    position: "Viewer",
    status: "active",
  },
};
