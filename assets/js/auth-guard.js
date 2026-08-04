/*
 * auth-guard.js  (Microsoft Entra ID / MSAL version)
 *
 * Include this AFTER:
 *   1. the MSAL browser CDN script (defines window.msal)
 *   2. assets/js/msal-config.js (defines window.MSAL_CONFIG / MSAL_LOGIN_SCOPES)
 *
 * Before including this file, a page can set:
 *
 *   window.REQUIRED_ROLES = ["internal", "admin"];
 *       Only these roles may view the page; anyone signed in with a
 *       different role is redirected to the page that matches their own
 *       role. Leave unset to allow any signed-in role.
 *       (window.REQUIRED_ROLE, a single string, is still accepted for
 *       backwards compatibility and is treated as a one-item list.)
 *
 *   window.AUTH_OPTIONAL = true;
 *       The page does not require sign-in at all. If nobody is signed
 *       in, the page is simply revealed with no role information. If
 *       someone IS signed in, their profile is still resolved as normal
 *       so the navbar can show the right buttons for their role.
 *       REQUIRED_ROLES is ignored on AUTH_OPTIONAL pages.
 *
 *   window.CLOSE_IF_SIGNED_OUT = true;
 *       The opposite of AUTH_OPTIONAL: this page requires sign-in, but
 *       instead of redirecting a signed-out visitor to index.html, the
 *       tab just closes itself (used for the Contractor Web Tool Guide,
 *       which is only ever opened as a secondary tab from a link on a
 *       page that already required sign-in). Sign-in status is checked
 *       via a shared "signed in" timestamp flag in localStorage (see
 *       AUTH_FLAG_KEY below) rather than this tab's own MSAL cache,
 *       since localStorage is instantly consistent across every tab of
 *       this site with no cross-tab timing issues. This also means it
 *       reacts live: if the person logs out from another tab of this
 *       app while this tab is still open, this tab closes itself
 *       immediately. A page must include a div#auth-close-fallback
 *       element for the case where the browser blocks a
 *       script-initiated tab close.
 *
 * Leave both unset on the login page (index.html).
 *
 * The <html> tag on protected pages should start with class="auth-checking"
 * (same as before) so the page content is hidden until the auth check
 * finishes (either confirming sign-in, or - on an AUTH_OPTIONAL page -
 * confirming there's nothing more to check).
 *
 * Roles come from Entra ID App Roles: in the Microsoft Entra admin center,
 * define app roles (e.g. "internal", "external", "admin") on the app
 * registration, then assign each user to one role under Enterprise
 * Applications -> your app -> Users and groups. That assignment is what
 * ends up in profile.role below.
 *
 * companyid / companyname / flname are read from the signed-in user's own
 * Microsoft Graph profile (Employee ID, Company Name, Display Name). Set
 * these on each user under Entra admin center -> Users -> [user] ->
 * Properties -> Job info / Identity.
 *
 * Once loaded, this file exposes window.authProfile = { id, email, role,
 * companyid, companyname, flname } (or null, on an AUTH_OPTIONAL page with
 * nobody signed in) and fires an "auth-ready" event on document with that
 * same value as event.detail.
 */
(function () {
    "use strict";

    if (!window.msal || !window.MSAL_CONFIG) {
        console.error("MSAL is not configured. Check assets/js/msal-config.js and the MSAL CDN script tag.");
        return;
    }

    var msalInstance = new window.msal.PublicClientApplication(window.MSAL_CONFIG);
    window.msalInstance = msalInstance; // exposed in case the page wants it (e.g. logout button)

    // A lightweight "someone is signed in" signal shared across every tab
    // of this app via localStorage. Unlike sessionStorage (used for the
    // MSAL cache itself — deliberately tab-scoped, see msal-config.js),
    // localStorage is the same physical storage for every tab of this
    // origin, with no cloning/timing quirks, so it's a reliable way for a
    // brand-new tab (the Contractor Web Tool Guide) to know immediately
    // whether the person opening it is signed in, and to find out live if
    // they sign out from another tab afterwards. It only ever holds a
    // timestamp, never any account details.
    var AUTH_FLAG_KEY = "csdtccps-signed-in-at";
    var AUTH_FLAG_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

    function markSignedIn() {
        try { localStorage.setItem(AUTH_FLAG_KEY, String(Date.now())); } catch (err) { /* ignore */ }
    }

    function clearSignedInFlag() {
        try { localStorage.removeItem(AUTH_FLAG_KEY); } catch (err) { /* ignore */ }
    }

    function isSignedInFlagFresh() {
        var raw;
        try { raw = localStorage.getItem(AUTH_FLAG_KEY); } catch (err) { return false; }
        var ts = raw && parseInt(raw, 10);
        return !!ts && (Date.now() - ts) < AUTH_FLAG_MAX_AGE_MS;
    }

    function closeThisTab() {
        // Don't reveal the real page content on the way out — just
        // attempt to close, and fall back to a manual-close message if
        // the browser blocks a script-initiated close (e.g. no opener,
        // or a strict browser policy).
        try {
            window.close();
        } catch (err) {
            // ignore
        }
        setTimeout(function () {
            var fallback = document.getElementById("auth-close-fallback");
            if (fallback) fallback.style.display = "block";
        }, 250);
    }

    function goToLogin(reason) {
        if (window.CLOSE_IF_SIGNED_OUT) {
            closeThisTab();
            return;
        }
        var suffix = reason ? ("?reason=" + encodeURIComponent(reason)) : "";
        window.location.replace("index.html" + suffix);
    }

    function pageForRole(role) {
        if (role === "internal") return "prequalformint.html";
        if (role === "external") return "prequalformcon.html";
        if (role === "admin") return "prequalformcon.html";
        return "index.html";
    }

    function getRequiredRoles() {
        if (window.REQUIRED_ROLES && window.REQUIRED_ROLES.length) return window.REQUIRED_ROLES;
        if (window.REQUIRED_ROLE) return [window.REQUIRED_ROLE];
        return null;
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

    function revealAnonymous() {
        document.documentElement.classList.remove("auth-checking");
        window.authProfile = null;
        document.dispatchEvent(new CustomEvent("auth-ready", { detail: null }));
    }

    function wireLogoutButton(account) {
        var logoutBtn = document.getElementById("btn-logout");
        if (!logoutBtn || logoutBtn.dataset.wired) return;
        logoutBtn.dataset.wired = "1";
        logoutBtn.addEventListener("click", function () {
            clearSignedInFlag();
            msalInstance.logoutRedirect({
                account: account,
                // onRedirectNavigate returning false stops MSAL from
                // actually navigating the browser to Microsoft's own
                // sign-out page. MSAL still fully clears THIS APP's
                // local session before this callback runs (so the next
                // person on a shared computer never inherits it) — but
                // because we stop the navigation, the person's
                // browser-wide Microsoft session (Outlook, Teams,
                // SharePoint, or any other Microsoft site open in the
                // same browser) is left completely untouched. This is a
                // deliberate choice for shared corporate computers,
                // where signing someone out of everything Microsoft
                // just because they logged out of this one form tool
                // would be a disruptive surprise.
                onRedirectNavigate: function () {
                    window.location.replace("index.html");
                    return false;
                }
            });
        });
    }

    async function guard() {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise().catch(function (err) {
            console.error("[auth-guard] redirect handling error:", err);
            // Same reasoning as index.html: a lost redirect state is a
            // recoverable hiccup, not a real failure. Just send them back
            // to sign in again with a friendly explanation.
        });

        // CLOSE_IF_SIGNED_OUT pages (the Contractor Web Tool Guide) are
        // opened as a brand-new tab. Check the shared flag immediately —
        // this is synchronous and instantly consistent across tabs, so
        // there's no waiting or guessing involved.
        if (window.CLOSE_IF_SIGNED_OUT && !isSignedInFlagFresh()) {
            closeThisTab();
            return;
        }

        var accounts = msalInstance.getAllAccounts();
        if (!accounts.length) {
            if (window.AUTH_OPTIONAL) {
                revealAnonymous();
                return;
            }
            if (window.CLOSE_IF_SIGNED_OUT) {
                // The shared flag (checked above) says this person is
                // signed in somewhere in this app, but this tab's own
                // MSAL cache doesn't have the account (a same-origin
                // sessionStorage-cloning edge case some browsers hit).
                // Trust the flag rather than wrongly closing on someone
                // who does have access — reveal the guide with generic
                // content instead of personalized nav details.
                document.documentElement.classList.remove("auth-checking");
                window.addEventListener("storage", function (event) {
                    if (event.key === AUTH_FLAG_KEY && !event.newValue) {
                        closeThisTab();
                    }
                });
                return;
            }
            goToLogin("signin_required");
            return;
        }

        var account = accounts[0];
        msalInstance.setActiveAccount(account);

        var role = getRoleFromAccount(account);
        if (!role) {
            if (window.AUTH_OPTIONAL) {
                revealAnonymous();
                return;
            }
            goToLogin("no_access");
            return;
        }

        var requiredRoles = window.AUTH_OPTIONAL ? null : getRequiredRoles();
        if (requiredRoles && requiredRoles.indexOf(role) === -1) {
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

        wireLogoutButton(account);

        // Keep the shared "signed in" flag fresh for as long as this tab
        // stays open, so a Contractor Web Tool Guide tab opened later
        // (or still open) can rely on it.
        markSignedIn();
        setInterval(markSignedIn, 60 * 1000);

        if (window.CLOSE_IF_SIGNED_OUT) {
            // Live: if the person logs out from another tab of this app
            // while this tab is still open, the "storage" event fires
            // here (never in the tab that made the change) the instant
            // clearSignedInFlag() runs there.
            window.addEventListener("storage", function (event) {
                if (event.key === AUTH_FLAG_KEY && !event.newValue) {
                    closeThisTab();
                }
            });
        }

        // Note: there is intentionally no "change password" feature here.
        // Under Entra ID, this app never sees, stores, or handles a
        // password at all — sign-in happens entirely on Microsoft's own
        // login page, and many external/guest users authenticate via a
        // one-time email code with no password involved whatsoever. A
        // "change password" button has nothing meaningful left to do.
    }

    guard();
})();
