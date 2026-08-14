import { render, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
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

vi.mock("@/lib/pwa", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pwa")>("@/lib/pwa");
  return {
    ...actual,
    isStandalonePwa: () => true,
  };
});

const firstAccount = {
  homeAccountId: "home-1",
  localAccountId: "local-1",
  username: "first@example.com",
  name: "First User",
  idTokenClaims: { tid: "tenant-1", oid: "object-1" },
};

const secondAccount = {
  homeAccountId: "home-2",
  localAccountId: "local-2",
  username: "second@example.com",
  name: "Second User",
  idTokenClaims: { tid: "tenant-1", oid: "object-2" },
};

function syncedUser(email: string) {
  return {
    id: `${email}-id`,
    email,
    name: email === "second@example.com" ? "Second User" : "First User",
    roleId: "admin",
    roleIds: ["admin"],
    permissions: [],
    department: "IT",
    position: "Developer",
    employeeId: "EMP001",
    status: "active" as const,
  };
}

describe("AuthProvider PWA account switching", () => {
  const acquireTokenSilent = vi.fn().mockRejectedValue(new Error("no token"));
  const loginRedirect = vi.fn().mockResolvedValue(undefined);
  const logoutRedirect = vi.fn();
  const setActiveAccount = vi.fn();
  const getActiveAccount = vi.fn(() => firstAccount);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/LIS/dashboard");
    vi.mocked(api.post).mockImplementation(async (_path, body: { email: string }) => ({
      data: { data: syncedUser(body.email) },
    }));
    vi.mocked(useMsal).mockReturnValue({
      accounts: [firstAccount, secondAccount],
      instance: {
        acquireTokenSilent,
        getActiveAccount,
        setActiveAccount,
        loginRedirect,
        logoutRedirect,
      },
    } as never);
  });

  it("switches to another cached Microsoft account without logging out", async () => {
    function SwitchOnMount() {
      const auth = useAuth() as ReturnType<typeof useAuth> & {
        accounts: { id: string; email: string }[];
        switchAccount: (accountId: string) => void;
      };

      const switched = useRef(false);

      useEffect(() => {
        if (switched.current) return;
        const target = auth.accounts.find((account) => account.email === "second@example.com");
        if (!target) return;
        switched.current = true;
        auth.switchAccount(target.id);
      }, [auth]);

      return <div>{auth.user?.email ?? "loading"}</div>;
    }

    render(
      <AuthProvider>
        <SwitchOnMount />
      </AuthProvider>,
    );

    await waitFor(() => expect(setActiveAccount).toHaveBeenCalledWith(secondAccount));
    expect(logoutRedirect).not.toHaveBeenCalled();
    await waitFor(() => expect(localStorage.getItem("lis.pwa.activeAccountId")).toBe("home-2"));
  });

  it("adds another Microsoft account with account selection instead of logout", async () => {
    function AddAccountOnMount() {
      const auth = useAuth() as ReturnType<typeof useAuth> & {
        addAccount: () => Promise<void>;
      };

      const added = useRef(false);

      useEffect(() => {
        if (added.current) return;
        added.current = true;
        void auth.addAccount();
      }, [auth]);

      return null;
    }

    render(
      <AuthProvider>
        <AddAccountOnMount />
      </AuthProvider>,
    );

    await waitFor(() => expect(loginRedirect).toHaveBeenCalled());
    expect(loginRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "select_account" }),
    );
    expect(logoutRedirect).not.toHaveBeenCalled();
  });
});


