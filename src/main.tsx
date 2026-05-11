import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./lib/msalConfig";
import App from "./App.tsx";
import "./index.css";

msalInstance.initialize().then(async () => {
  const response = await msalInstance.handleRedirectPromise({
    navigateToLoginRequestUrl: false,
  });
  const account = response?.account ?? msalInstance.getAllAccounts()[0];

  if (account) {
    msalInstance.setActiveAccount(account);
  }

  createRoot(document.getElementById("root")!).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
});
