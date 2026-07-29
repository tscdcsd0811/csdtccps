/*
 * auth-guard.js
 *
 * Include this AFTER:
 *   1. the Supabase CDN script (defines window.supabase.createClient)
 *   2. assets/js/supabase-config.js (defines window.SUPABASE_URL / SUPABASE_ANON_KEY)
 *
 * Before including this file, set:
 *   window.REQUIRED_ROLE = "internal";   // or "external"
 * on the page that should be protected. Leave it unset on the login page.
 *
 * The <html> tag on protected pages should start with class="auth-checking"
 * and the page should include the matching CSS (see prequalformcon.html /
 * prequalformint.html for the pattern) so the form content is hidden until
 * the user is confirmed to be logged in with the right role.
 */
(function () {
    "use strict";

    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        console.error("Supabase is not configured. Fill in assets/js/supabase-config.js");
        return;
    }

    var client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    window.sbClient = client; // exposed in case the page wants it (e.g. logout button)

    function goToLogin(reason) {
        var suffix = reason ? ("?reason=" + encodeURIComponent(reason)) : "";
        window.location.replace("index.html" + suffix);
    }

    function pageForRole(role) {
        if (role === "internal") return "prequalformint.html";
        if (role === "external") return "prequalformcon.html";
        return "index.html";
    }

    async function guard() {
        var sessionResult = await client.auth.getSession();
        var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;

        if (!session) {
            goToLogin("signin_required");
            return;
        }

        var profileResult = await client
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

        var profile = profileResult.data;
        var error = profileResult.error;

        if (error || !profile || !profile.role) {
            await client.auth.signOut();
            goToLogin("no_access");
            return;
        }

        if (window.REQUIRED_ROLE && profile.role !== window.REQUIRED_ROLE) {
            // Logged in, but this isn't their page — send them to the right one.
            window.location.replace(pageForRole(profile.role));
            return;
        }

        // Authorized: reveal the page.
        document.documentElement.classList.remove("auth-checking");

        console.log("[auth-guard] signed in as", session.user.email, "role:", profile.role);

        var emailLabel = document.getElementById("auth-user-email");
        if (emailLabel) {
            emailLabel.textContent = session.user.email + " (" + profile.role + ")";
        }

        var logoutBtn = document.getElementById("btn-logout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async function () {
                await client.auth.signOut();
                goToLogin("");
            });
        }
    }

    guard();
})();
