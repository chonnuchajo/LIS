import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bootstrap resilience.
 *
 * MSAL's `handleRedirectPromise()` throws `no_token_request_cache_error` whenever
 * sessionStorage still holds `msal.interaction.status` but the matching
 * `msal.<clientId>.request.params` entry is gone — which happens if a login
 * redirect is interrupted (reload / back / slow authority discovery) after
 * `acquireTokenRedirect` set the in-progress flag but before it cached the
 * request. MSAL clears the stale entries and rethrows, so the condition is
 * recoverable — but it must never take the whole app render down with it.
 */

const initialize = vi.fn(() => Promise.resolve());
const handleRedirectPromise = vi.fn();
const getAllAccounts = vi.fn(() => [] as unknown[]);
const setActiveAccount = vi.fn();
const render = vi.fn();

vi.mock("./lib/msalConfig", () => ({
  msalInstance: {
    initialize,
    handleRedirectPromise,
    getAllAccounts,
    setActiveAccount,
  },
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render, unmount: vi.fn() })),
}));

vi.mock("@azure/msal-react", () => ({
  MsalProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./App.tsx", () => ({ default: () => null }));
vi.mock("./pages/Home", () => ({ default: () => null }));
vi.mock("./lib/accessControlSource", () => ({
  loadAccessControl: vi.fn(() => Promise.resolve({})),
}));

describe("app bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    initialize.mockResolvedValue(undefined);
    getAllAccounts.mockReturnValue([]);
    document.body.innerHTML = '<div id="root"></div>';
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("renders the app on the normal path", async () => {
    handleRedirectPromise.mockResolvedValue(null);

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  });

  it("restores a protected deep link after MSAL redirects back to the app root", async () => {
    sessionStorage.setItem("lis_login_redirect", "/stock-deduction?qrId=u_abc123");
    handleRedirectPromise.mockResolvedValue({ account: { homeAccountId: "acct" } });

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    expect(window.location.pathname + window.location.search).toBe("/stock-deduction?qrId=u_abc123");
    expect(sessionStorage.getItem("lis_login_redirect")).toBeNull();
  });

  it("restores an app-relative stock deduction deep link under the production basename", async () => {
    vi.stubEnv("BASE_URL", "/LIS/");
    window.history.replaceState(null, "", "/LIS/");
    sessionStorage.setItem("lis_login_redirect", "/stock-deduction?qrId=u_prod");
    handleRedirectPromise.mockResolvedValue({ account: { homeAccountId: "acct" } });

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    expect(window.location.pathname + window.location.search).toBe("/LIS/stock-deduction?qrId=u_prod");
    expect(sessionStorage.getItem("lis_login_redirect")).toBeNull();
  });

  it("restores a stored stock deduction deep link even when MSAL has no account yet", async () => {
    sessionStorage.setItem("lis_login_redirect", "/stock-deduction?qrId=u_scan");
    handleRedirectPromise.mockResolvedValue(null);

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    expect(window.location.pathname + window.location.search).toBe("/stock-deduction?qrId=u_scan");
    expect(sessionStorage.getItem("lis_login_redirect")).toBeNull();
  });
  it("still renders the app when handleRedirectPromise rejects on a stale MSAL cache", async () => {
    handleRedirectPromise.mockRejectedValue(
      Object.assign(new Error("no_token_request_cache_error"), {
        errorCode: "no_token_request_cache_error",
        name: "BrowserAuthError",
      }),
    );

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  });

  it("still renders the app when MSAL initialize() rejects", async () => {
    initialize.mockRejectedValue(new Error("msal init failed"));

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
  });
});
