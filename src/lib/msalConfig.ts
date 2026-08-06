import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID;
const TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;

if (!CLIENT_ID || !TENANT_ID) {
  // Vite resolves these from the .env at the REPO ROOT (server/.env is the
  // backend's and is never bundled), inlining them at build time. Left unset
  // they silently produce an authority of ".../undefined", which Azure rejects
  // at sign-in with AADSTS900023 rather than at startup — so say it here.
  console.error(
    "[auth] VITE_AZURE_CLIENT_ID / VITE_AZURE_TENANT_ID are missing. " +
      "Set them in the repo-root .env and restart Vite (or rebuild for production).",
  );
}

// Redirect URI must match exactly what's registered in Azure App Registration.
const REDIRECT_URI =
  window.location.origin + (import.meta.env.MODE === "production" ? "/LIS/" : "/");

const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
