// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Driven by Vite's build mode: true under `npm run dev`, false under
// `npm run build`. Never hardcode this — a tracked literal causes endless
// merge conflicts and risks shipping a dev-mode production build.
export const DEV_MODE = import.meta.env.DEV;

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
    position: "Administrator",
    status: "active",
  },
  lab: {
    id: "dev-lab",
    email: "lab.dev@icpladda.com",
    name: "Dev Lab",
    role: "lab",
    permissions: [],
    department: "Lab",
    position: "Lab Technician",
    status: "active",
  },
  qc: {
    id: "dev-qc",
    email: "qc.dev@icpladda.com",
    name: "Dev QC",
    role: "qc",
    permissions: [],
    department: "QC",
    position: "QC Officer",
    status: "active",
  },
  viewer: {
    id: "dev-viewer",
    email: "viewer.dev@icpladda.com",
    name: "Dev Viewer",
    role: "viewer",
    permissions: [],
    department: "Office",
    position: "Viewer",
    status: "active",
  },
};
