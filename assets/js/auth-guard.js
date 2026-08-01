/*
 * auth-guard.js  (Microsoft Entra ID / MSAL version)
 *
 * Include this AFTER:
 *   1. the MSAL browser CDN script (defines window.msal)
 *   2. assets/js/msal-config.js (defines window.MSAL_CONFIG / MSAL_LOGIN_SCOPES)
 *
 * Before including this file, set:
 *   window.REQUIRED_ROLE = "internal";   // or "external"
 * on the page that should be protected. Leave it unset on the login page.
 *
 * The <html> tag on protected pages should start with class="auth-checking"
 * (same as before) so the form content is hidden until the user is
 * confirmed to be signed in with the right role.
 *
 * Roles come from Entra ID App Roles: in the Microsoft Entra admin center,
 * define "internal" and "external" app roles on the app registration, then
 * assign each user to one role under Enterprise Applications -> your app ->
 * Users and groups. That assignment is what ends up in profile.role below —
 * it replaces the old "profiles" table + Row Level Security.
 *
 * companyid / companyname / flname are read from the signed-in user's own
 * Microsoft Graph profile (Employee ID, Company Name, Display Name) instead
 * of a database row. Set these on each user under Entra admin center ->
 * Users -> [user] -> Properties -> Job info / Identity.
 *
 * Once loaded, this file exposes window.authProfile = { id, email, role,
 * companyid, companyname, flname } and fires an "auth-ready" event on
 * document with that same object as event.detail — identical contract to
 * the previous Supabase-based version, so pages that consume it don't need
 * to change.
 */
(function () {
    "use strict";

    if (!window.msal || !window.MSAL_CONFIG) {
        console.error("MSAL is not configured. Check assets/js/msal-config.js and the MSAL CDN script tag.");
        return;
    }

    var msalInstance = new window.msal.PublicClientApplication(window.MSAL_CONFIG);
    window.msalInstance = msalInstance; // exposed in case the page wants it (e.g. logout button)

    function goToLogin(reason) {
        var suffix = reason ? ("?reason=" + encodeURIComponent(reason)) : "";
        window.location.replace("index.html" + suffix);
    }

    function pageForRole(role) {
        if (role === "internal") return "prequalformint.html";
        if (role === "external") return "prequalformcon.html";
        return "index.html";
    }

    function getRoleFromAccount(account) {
        var claims = account && account.idTokenClaims;
        var roles = claims && claims.roles;
        return (roles && roles.length) ? roles[0] : null;
    }

    async function fetchGraphProfile(accessToken) {
        try {
            var response = await fetch(
                "https://graph.microsoft.com/v1.0/me?$select=displayName,companyName,employeeId",
                { headers: { Authorization: "Bearer " + accessToken } }
            );
            if (!response.ok) return {};
            return await response.json();
        } catch (err) {
            console.warn("[auth-guard] could not read Microsoft Graph profile:", err);
            return {};
        }
    }

    async function guard() {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise().catch(function (err) {
            console.error("[auth-guard] redirect handling error:", err);
        });

        var accounts = msalInstance.getAllAccounts();
        if (!accounts.length) {
            goToLogin("signin_required");
            return;
        }

        var account = accounts[0];
        msalInstance.setActiveAccount(account);

        var role = getRoleFromAccount(account);
        if (!role) {
            goToLogin("no_access");
            return;
        }

        if (window.REQUIRED_ROLE && role !== window.REQUIRED_ROLE) {
            // Signed in, but this isn't their page — send them to the right one.
            window.location.replace(pageForRole(role));
            return;
        }

        // Get a Graph token silently (no popup) to read the user's own profile.
        var graphProfile = {};
        try {
            var tokenResult = await msalInstance.acquireTokenSilent({
                account: account,
                scopes: ["User.Read"]
            });
            graphProfile = await fetchGraphProfile(tokenResult.accessToken);
        } catch (err) {
            console.warn("[auth-guard] could not acquire Graph token:", err);
        }

        // Authorized: reveal the page.
        document.documentElement.classList.remove("auth-checking");

        console.log("[auth-guard] signed in as", account.username, "role:", role);

        var emailLabel = document.getElementById("auth-user-email");
        if (emailLabel) {
            emailLabel.textContent = account.username;
        }

        window.authProfile = {
            id: account.homeAccountId,
            email: account.username,
            role: role,
            companyid: graphProfile.employeeId || "",
            companyname: graphProfile.companyName || "",
            flname: graphProfile.displayName || account.name || ""
        };
        document.dispatchEvent(new CustomEvent("auth-ready", { detail: window.authProfile }));

        var logoutBtn = document.getElementById("btn-logout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", function () {
                msalInstance.logoutRedirect({ account: account });
            });
        }

        var changePasswordBtn = document.getElementById("btn-change-password");
        if (changePasswordBtn) {
            // Microsoft accounts manage their own password reset/change through
            // Microsoft's own security portal — there's no equivalent client-side
            // API call for a static site to do this itself (unlike the old
            // Supabase updateUser() call), so this just opens Microsoft's page.
            changePasswordBtn.addEventListener("click", function () {
                window.open("https://mysignins.microsoft.com/security-info", "_blank", "noopener");
            });
        }
    }

    guard();
})();
