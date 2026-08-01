/*
 * Microsoft Entra ID (MSAL) connection settings.
 *
 * Fill these in after registering the app in the Microsoft Entra admin
 * center (https://entra.microsoft.com -> Applications -> App registrations
 * -> New registration):
 *
 *   - CLIENT_ID  -> "Application (client) ID" on the app's Overview page.
 *   - TENANT_ID  -> "Directory (tenant) ID" on the same page.
 *   - REDIRECT_URI -> must exactly match a URI listed under
 *                     Authentication -> Platform configurations ->
 *                     Single-page application -> Redirect URIs.
 *                     For this repo, that's the published index.html URL,
 *                     e.g. https://tscdcsd0811.github.io/csdtccps/index.html
 *
 * These values are safe to expose in client-side code: the client ID is a
 * public identifier (not a secret), and MSAL uses the Authorization Code
 * flow with PKCE, which never requires a client secret for browser apps.
 */
window.MSAL_CONFIG = {
    auth: {
        clientId: "5ce14b62-c706-4cea-9411-9a0e45696483",
        authority: "https://login.microsoftonline.com/d2389b64-87bf-49e0-8809-6850628b5823",
        redirectUri: "https://tscdcsd0811.github.io/csdtccps/index.html",
        postLogoutRedirectUri: "https://tscdcsd0811.github.io/csdtccps/index.html",
        navigateToLoginRequestUrl: true
    },
    cache: {
        // sessionStorage (not localStorage) is deliberate: it's scoped to a
        // single browser tab/window and is automatically wiped the moment
        // that tab or window closes. On a shared/kiosk-style computer, this
        // guarantees the next person who opens the site never inherits a
        // previous person's signed-in session, even if they forgot to click
        // "Log out". The tradeoff is that each new browser window requires
        // signing in again, even on a personal device — the right tradeoff
        // for a tool used on shared computers.
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
    }
};

// Scopes requested at sign-in. User.Read lets the app read the signed-in
// user's own basic profile (name, company, employee ID) from Microsoft
// Graph — the equivalent of the old "profiles" table lookup.
window.MSAL_LOGIN_SCOPES = ["openid", "profile", "User.Read"];
