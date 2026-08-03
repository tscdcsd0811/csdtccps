# Deploying with Microsoft Entra ID (replaces Supabase)

This app now signs users in with their Microsoft account via Entra ID
instead of Supabase. Hosting stays on GitHub Pages — nothing about that
part changes. This doc replaces the Supabase-related steps in the old
DEPLOY.md; keep the rest of that file (GitHub Pages publishing steps) as-is.
(Note: DEPLOY.md itself has since been removed from this repo as outdated —
this file is now the current setup reference.)

## 1. Register the app in Entra ID

1. Go to https://entra.microsoft.com and sign in with your Microsoft 365
   admin account (or ask whoever manages your company's tenant to do this
   part — it takes about 5 minutes).
2. **Applications -> App registrations -> New registration**.
3. Name: `Engineers Qualification Board` (or anything you like).
4. Supported account types: **Accounts in this organizational directory
   only** (single tenant) — keeps it to your company + any guests you
   explicitly invite.
5. Redirect URI: platform = **Single-page application (SPA)**, URI =
   `https://tscdcsd0811.github.io/csdtccps/index.html`
6. Click **Register**.
7. On the app's **Overview** page, copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**

## 2. Fill in the config file

Open `assets/js/msal-config.js` and paste those two values in:

```js
clientId: "...paste Application (client) ID here...",
authority: "https://login.microsoftonline.com/...paste Tenant ID here...",
```

Commit and push. GitHub Pages will redeploy automatically.

## 3. Define the two app roles (internal / external)

1. In the app registration, go to **App roles** (left sidebar) -> **Create
   app role**.
2. Create one role:
   - Display name: `Internal`
   - Value: `internal`   <- must be exactly this, lowercase (the code checks
     for this exact string)
   - Description: anything
   - Allowed member types: **Users/Groups**
3. Repeat for a second role with Value `external`.

## 4. Assign each user to a role

1. Go to **Identity -> Applications -> Enterprise applications** -> find
   this app (same name as the registration) -> **Users and groups**.
2. **Add user/group** -> pick a person -> under "Select a role" choose
   either `Internal` or `External` -> **Assign**.
3. Repeat for everyone who needs access — this list is exactly the
   equivalent of the old `profiles` table's `role` column.

For **external users** (people outside your company, e.g. contractor
companies) who don't already have an account in your tenant: use
**Identity -> External Identities -> Guest users -> New guest user** to
invite them by email first (they accept once, then show up as assignable
users in step above). This is the equivalent of adding a user in Supabase
Auth.

## 5. Set each user's name / company info

These three fields auto-fill the forms the same way the old `profiles`
table did (`flname`, `companyname`, `companyid`):

Go to **Identity -> Users -> [pick a user] -> Properties**:

- **Display name** (Identity section) -> becomes `flname`
- **Company name** (Job info section) -> becomes `companyname`
- **Employee ID** (Job info section) -> becomes `companyid`

If any of these are left blank, the corresponding field on the form just
starts empty — same fallback behavior as before, nothing breaks.

## 6. Test

1. Open `https://tscdcsd0811.github.io/csdtccps/` (or your custom domain,
   once/if that's ever unblocked).
2. Click **Sign in with Microsoft**.
3. Sign in with a user you assigned a role to in step 4.
4. Should land on the correct form (`prequalformint.html` for Internal,
   `prequalformcon.html` for External) with their name/company pre-filled.
5. A user with no role assigned should see "Your account does not have
   access assigned yet."

## What changed vs. the Supabase version

| Old (Supabase) | New (Entra ID) |
|---|---|
| Email + password form | "Sign in with Microsoft" button |
| `profiles` table, `role` column | Entra ID App Roles + user assignment |
| `profiles.companyid/companyname/flname` | Employee ID / Company name / Display name on the Entra user record |
| Supabase Auth `updateUser()` password change | Opens Microsoft's own security-info page |
| `assets/js/supabase-config.js` (deleted) | `assets/js/msal-config.js` |

`supabase/schema.sql` is no longer used and has already been removed
from the repo, along with `companieslist.html` (old company-picker,
replaced by Entra ID profile auto-fill) and `DEPLOY.md` (superseded by
this file) — all three were confirmed unreferenced by any live page
before being deleted.
