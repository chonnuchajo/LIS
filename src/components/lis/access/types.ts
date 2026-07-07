export type UserStatus = "active" | "inactive";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleIds: string[];
  department: string;
  position: string;
  employeeId: string;
  status: UserStatus;
  lastActive: string;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
};

export type AccessGroup = {
  id: string;
  name: string;
  description: string;
  paths: string[];
  locked?: boolean;
  sortOrder?: number;
};

export type EmployeeDirectoryEntry = {
  employeeId: string;
  name: string;
  department: string;
  position: string;
  email: string;
};
