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
 *
 * Optional buttons this file will wire up automatically if present:
 *   <button id="btn-logout">            - signs the user out
 *   <button id="btn-change-password">   - opens a self-service
 *                                          change-password modal
 *   <span id="auth-user-email">         - filled with "email (role)"
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

        var changePasswordBtn = document.getElementById("btn-change-password");
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener("click", function () {
                openChangePasswordModal();
            });
        }
    }

    /* ====== Change Password modal ======
     * Injected once, on demand, so pages only need a
     * <button id="btn-change-password"> - no extra markup required.
     */
    var modalEl = null;

    function buildChangePasswordModal() {
        if (modalEl) return modalEl;

        var style = document.createElement("style");
        style.textContent =
            ".cpw-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);" +
            "z-index:9999;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;}" +
            ".cpw-overlay.open{display:flex;}" +
            ".cpw-box{background:#fff;width:100%;max-width:340px;padding:22px 22px 18px;border-radius:8px;" +
            "box-shadow:0 4px 20px rgba(0,0,0,0.25);box-sizing:border-box;}" +
            ".cpw-box h3{margin:0 0 14px;font-size:16px;color:#222;}" +
            ".cpw-box label{display:block;font-size:12px;font-weight:bold;color:#333;margin-bottom:4px;}" +
            ".cpw-box input{width:100%;padding:8px 9px;margin-bottom:12px;border:1px solid #ccc;" +
            "border-radius:4px;font-size:14px;box-sizing:border-box;}" +
            ".cpw-msg{font-size:12px;min-height:14px;margin-bottom:10px;}" +
            ".cpw-msg.error{color:#c0392b;}" +
            ".cpw-msg.success{color:#1a7f4b;}" +
            ".cpw-btns{display:flex;gap:8px;justify-content:flex-end;}" +
            ".cpw-btns button{padding:8px 16px;font-size:13px;font-weight:bold;border-radius:4px;" +
            "cursor:pointer;border:none;}" +
            ".cpw-btn-cancel{background:#e0e0e0;color:#333;}" +
            ".cpw-btn-save{background:#0d6efd;color:#fff;}" +
            ".cpw-btn-save:disabled{background:#93bdfb;cursor:default;}";
        document.head.appendChild(style);

        var overlay = document.createElement("div");
        overlay.className = "cpw-overlay";
        overlay.innerHTML =
            '<div class="cpw-box">' +
            "<h3>Change Password</h3>" +
            '<label for="cpw-new">New password</label>' +
            '<input type="password" id="cpw-new" autocomplete="new-password">' +
            '<label for="cpw-confirm">Confirm new password</label>' +
            '<input type="password" id="cpw-confirm" autocomplete="new-password">' +
            '<div class="cpw-msg" id="cpw-msg"></div>' +
            '<div class="cpw-btns">' +
            '<button type="button" class="cpw-btn-cancel" id="cpw-cancel">Cancel</button>' +
            '<button type="button" class="cpw-btn-save" id="cpw-save">Save</button>' +
            "</div></div>";
        document.body.appendChild(overlay);

        var newInput = overlay.querySelector("#cpw-new");
        var confirmInput = overlay.querySelector("#cpw-confirm");
        var msgEl = overlay.querySelector("#cpw-msg");
        var saveBtn = overlay.querySelector("#cpw-save");
        var cancelBtn = overlay.querySelector("#cpw-cancel");

        function showMsg(text, type) {
            msgEl.textContent = text;
            msgEl.className = "cpw-msg" + (type ? " " + type : "");
        }

        function close() {
            overlay.classList.remove("open");
            newInput.value = "";
            confirmInput.value = "";
            showMsg("", "");
            saveBtn.disabled = false;
        }

        cancelBtn.addEventListener("click", close);
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) close();
        });

        saveBtn.addEventListener("click", async function () {
            var pw = newInput.value;
            var confirmPw = confirmInput.value;

            if (pw.length < 6) {
                showMsg("Password must be at least 6 characters.", "error");
                return;
            }
            if (pw !== confirmPw) {
                showMsg("Passwords do not match.", "error");
                return;
            }

            saveBtn.disabled = true;
            showMsg("Saving...", "");

            var result = await client.auth.updateUser({ password: pw });

            if (result.error) {
                showMsg("Couldn't change password: " + result.error.message, "error");
                saveBtn.disabled = false;
                return;
            }

            showMsg("Password changed successfully.", "success");
            setTimeout(close, 1400);
        });

        modalEl = overlay;
        return overlay;
    }

    function openChangePasswordModal() {
        var overlay = buildChangePasswordModal();
        overlay.classList.add("open");
        overlay.querySelector("#cpw-new").focus();
    }

    guard();
})();
