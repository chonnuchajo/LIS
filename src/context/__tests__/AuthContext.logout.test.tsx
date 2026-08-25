import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMsal } from "@azure/msal-react";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(),
}));

vi.mock("@/lib/msalConfig", () => ({
  loginRequest: { scopes: ["User.Read", "openid", "profile", "email"] },
}));

vi.mock("@/lib/api", () => ({
  api: {
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

const syncedUser = {
  id: "user-1",
  email: "tester@example.com",
  name: "Test User",
  roleId: "admin",
  roleIds: ["admin"],
  permissions: [],
  department: "IT",
  position: "Developer",
  employeeId: "EMP001",
  status: "active" as const,
};

function LogoutOnMount() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return null;
}

describe("AuthProvider logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/LIS/dashboard");
    vi.mocked(api.post).mockResolvedValue({ data: { data: syncedUser } });
  });

  it("sends Microsoft logout back to the LIS login route", async () => {
    const logoutRedirect = vi.fn();
    const acquireTokenSilent = vi.fn().mockRejectedValue(new Error("no token"));

    vi.mocked(useMsal).mockReturnValue({
      accounts: [
        {
          username: "tester@example.com",
          name: "Test User",
          localAccountId: "local-account-1",
          idTokenClaims: { tid: "tenant-1", oid: "object-1" },
        },
      ],
      instance: {
        acquireTokenSilent,
        logoutRedirect,
      },
    } as never);

    render(
      <AuthProvider>
        <LogoutOnMount />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(logoutRedirect).toHaveBeenCalledWith({
        postLogoutRedirectUri: `${window.location.origin}/login`,
      }),
    );
  });
});
