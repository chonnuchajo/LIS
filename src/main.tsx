import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./lib/msalConfig";
import App from "./App.tsx";
import "./index.css";
import { loadAccessControl } from "./lib/accessControlSource";

msalInstance.initialize().then(async () => {
  const response = await msalInstance.handleRedirectPromise({
    navigateToLoginRequestUrl: false,
  });
  const account = response?.account ?? msalInstance.getAllAccounts()[0];

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
