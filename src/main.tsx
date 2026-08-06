import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./lib/msalConfig";
import App from "./App.tsx";
import "./index.css";
import { loadAccessControl } from "./lib/accessControlSource";

// Resolving the sign-in redirect must never be able to abort the render.
// MSAL throws `no_token_request_cache_error` whenever sessionStorage still
// holds `msal.interaction.status` but its matching `request.params` entry is
// gone — the state a login redirect leaves behind when it is interrupted
// (reload, back button, slow authority discovery) between setting the
// in-progress flag and caching the request. MSAL clears the stale entries and
// rethrows, so the condition is recoverable; letting the rejection escape used
// to skip createRoot() entirely and leave the user on a blank page.
async function resolveActiveAccount() {
  try {
    await msalInstance.initialize();
  } catch (error) {
    console.error("[auth] MSAL failed to initialize; rendering logged out", error);
    return undefined;
  }

  let redirectAccount;
  try {
    const response = await msalInstance.handleRedirectPromise({
      navigateToLoginRequestUrl: false,
    });
    redirectAccount = response?.account;
  } catch (error) {
    // Stale redirect state, already cleaned up by MSAL — fall through to the
    // cached account so an existing session survives the failed redirect.
    console.error("[auth] sign-in redirect could not be completed", error);
  }

  return redirectAccount ?? msalInstance.getAllAccounts()[0];
}

resolveActiveAccount().then((account) => {
  if (account) {
    msalInstance.setActiveAccount(account);
    // Authenticated session: warm the landing route's chunk (Vite also preloads
    // its AppLayout dep) and the access-control matrix in parallel with React's
    // first mount, so neither is a sequential network hop before the home LCP.
    // Skipped when logged out so the /login page isn't slowed by a Home download.
    void import("./pages/Home");
    void loadAccessControl().catch(() => {});
  }

  createRoot(document.getElementById("root")!).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
});
