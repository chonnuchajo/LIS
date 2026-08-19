import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMsal } from "@azure/msal-react";
import { api, setApiUserEmail } from "@/lib/api";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(),
}));

vi.mock("@/lib/msalConfig", () => ({
  loginRequest: { scopes: ["User.Read", "openid", "profile", "email"] },
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  setApiUserEmail: vi.fn(),
}));

vi.mock("@/lib/accessControlSource", () => ({
  loadAccessControl: vi.fn(),
}));

vi.mock("@/config/dev", () => ({
  DEV_MODE: false,
  DEV_DEFAULT_ROLE: "admin",
  synthesizeDevUser: vi.fn(),
  normalizeDevRoleSelection: vi.fn((roleIds: string[]) => roleIds),
  normalizeDevDepartment: vi.fn((department: string | null) => department ?? ""),
  toggleDevRoleSelection: vi.fn((roleIds: string[]) => roleIds),
}));

const productionUser = {
  id: "prod-user-1",
  email: "prod@example.com",
  name: "Production User",
  role: "viewer",
  roles: ["viewer"],
  permissions: ["petition:view"],
  department: "Production",
  position: "Operator",
  employeeId: "EMP999",
  status: "active" as const,
};

function CurrentUserEmail() {
  const { user } = useAuth();
  return <div>{user?.email ?? "no-user"}</div>;
}

describe("AuthProvider production cookie session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/LIS/dashboard");
    vi.mocked(useMsal).mockReturnValue({
      accounts: [],
      instance: {
        acquireTokenSilent: vi.fn(),
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
      },
    } as never);
  });

  it("restores the production user from the server cookie session", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: productionUser } });

    render(
      <AuthProvider>
        <CurrentUserEmail />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("prod@example.com")).toBeInTheDocument());

    expect(api.get).toHaveBeenCalledWith("/auth/session");
    expect(localStorage.getItem("lis_production_sso_user")).toBe(JSON.stringify(productionUser));
    expect(setApiUserEmail).toHaveBeenLastCalledWith("prod@example.com");
  });
});
