import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

const CLIENT_ID = "3606c739-b089-4e15-80bc-cef9538b46dc";
const TENANT_ID = "2e73ca10-7e02-42ce-a4c8-d71202e7bc71";

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
