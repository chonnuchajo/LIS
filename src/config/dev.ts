// Dev mode bypasses Microsoft login and injects a hardcoded user.
// Keep VITE_DEV_MODE unset or set it to "false" outside local development.
export const DEV_MODE =
  import.meta.env.MODE === "development" &&
  import.meta.env.VITE_DEV_MODE !== "false";

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
