/*
 * navbar.js
 *
 * Fills in the shared sidebar navbar (see assets/css/navbar.css for the
 * expected markup). Listens for the "auth-ready" event fired by
 * auth-guard.js.
 *
 * event.detail is:
 *   - an authProfile object { id, email, role, ... } when someone is
 *     signed in (this happens on every protected page, and on
 *     AUTH_OPTIONAL pages when the visitor happens to already be signed
 *     in), or
 *   - null when nobody is signed in (only possible on AUTH_OPTIONAL
 *     pages, e.g. the web tool guides, which don't require sign-in).
 *
 * Responsibilities:
 *   1. Show only the nav links whose data-roles list includes the
 *      current user's role; hide the rest.
 *   2. Mark the link matching the current page as .active.
 *   3. Show either the signed-in email + Log out button, or a Sign in
 *      link, in the sidebar-bottom area.
 */
(function () {
    "use strict";

    function currentPageName() {
        var path = window.location.pathname;
        var last = path.substring(path.lastIndexOf("/") + 1);
        return last || "index.html";
    }

    function applyRoleVisibility(role) {
        var links = document.querySelectorAll(".app-sidebar nav a[data-roles]");
        links.forEach(function (link) {
            var allowed = link.getAttribute("data-roles").split(",").map(function (r) { return r.trim(); });
            var show = !!role && allowed.indexOf(role) !== -1;
            link.style.display = show ? "" : "none";
        });
    }

    function markActiveLink() {
        var here = currentPageName();
        var links = document.querySelectorAll(".app-sidebar nav a");
        links.forEach(function (link) {
            var href = (link.getAttribute("href") || "").split("?")[0].split("#")[0];
            if (href === here) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }

    function applySignedInState(profile) {
        var emailEl = document.getElementById("auth-user-email");
        var logoutBtn = document.getElementById("btn-logout");
        var signinLink = document.getElementById("nav-signin-link");

        if (profile && profile.email) {
            if (emailEl) {
                emailEl.textContent = profile.email;
                emailEl.style.display = "";
            }
            if (logoutBtn) logoutBtn.style.display = "";
            if (signinLink) signinLink.style.display = "none";
        } else {
            if (emailEl) {
                emailEl.textContent = "";
                emailEl.style.display = "none";
            }
            if (logoutBtn) logoutBtn.style.display = "none";
            if (signinLink) signinLink.style.display = "";
        }
    }

    function initNavbar(profile) {
        var role = profile && profile.role;
        applyRoleVisibility(role);
        markActiveLink();
        applySignedInState(profile);
    }

    document.addEventListener("auth-ready", function (e) {
        initNavbar(e.detail);
    });

    // In case auth-guard.js already fired auth-ready before this script
    // finished loading (e.g. a very fast silent sign-in), fall back to
    // whatever it already stored on window.authProfile once the DOM is
    // ready, so the navbar never gets stuck in its default state.
    document.addEventListener("DOMContentLoaded", function () {
        if (window.authProfile !== undefined) {
            initNavbar(window.authProfile);
        } else {
            markActiveLink();
        }
    });
})();
