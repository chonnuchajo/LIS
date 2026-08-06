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
    initialize.mockResolvedValue(undefined);
    getAllAccounts.mockReturnValue([]);
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("renders the app on the normal path", async () => {
    handleRedirectPromise.mockResolvedValue(null);

    await import("./main");

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
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
