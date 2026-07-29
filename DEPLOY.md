# Deploying this app with Supabase login + role-based access

## Important thing to know first

Supabase is a **backend** (database, auth, storage, functions) — it does not
host static websites the way GitHub Pages, Netlify, or Vercel do. So the
setup here is:

- **Supabase** = handles login (Auth) and stores who is "internal" vs
  "external" (Postgres table).
- **GitHub Pages** = serves your actual HTML files (it's free and your
  files are already in a GitHub repo, so this is the path of least
  resistance). Netlify/Vercel work identically if you'd rather use those.

Your HTML pages talk to Supabase entirely from the browser using the
`supabase-js` library loaded from a CDN — no server code to run or deploy.

---

## What was added to your project

```
index.html                     <- NEW. Login page. This is now your homepage.
prequalformcon.html             <- patched: only lets in users with role "external"
prequalformint.html             <- patched: only lets in users with role "internal"
assets/js/supabase-config.js    <- put your Supabase URL + key here
assets/js/auth-guard.js         <- shared logic that checks login + role
supabase/schema.sql             <- run once in Supabase to set up the database
```

`companieslist.html` and `csd_approvalreq_webtoolguide.html` were left as-is
(no login required for those).

---

## Part 1 — Set up Supabase

1. Go to [supabase.com](https://supabase.com), sign in, and click **New
   project**. Pick a name, database password, and region.
2. Once the project finishes provisioning, open **SQL Editor** in the left
   sidebar → **New query**, paste in the entire contents of
   `supabase/schema.sql` from this repo, and click **Run**.
   This creates a `profiles` table (with a `role` column that's either
   `internal`, `external`, or `unassigned`), locks it down with Row Level
   Security, and sets up a trigger so every new user automatically gets a
   profile row.
3. Go to **Authentication → Providers** and make sure **Email** is enabled
   (it is by default).
4. Go to **Authentication → Settings** (or **Sign In / Providers** depending
   on your dashboard version) and turn **off** "Confirm email" if you want
   to add users yourself and have them log in immediately without an email
   confirmation step. Since you're manually creating a fixed list of users
   rather than letting the public sign themselves up, this is the simplest
   option — but leave it on if you'd rather users confirm via email first.
5. Go to **Project Settings → API Keys** (or the **Connect** button at the
   top of the dashboard) and copy:
   - **Project URL**
   - **anon public** key (or the newer **Publishable key**, `sb_publishable_...`
     — either works the same way here)
6. **Only if you want the "Email code" sign-in option to work:** by default
   Supabase's "Magic Link" email template sends a clickable link, not a
   6-digit code. Go to **Authentication → Email Templates → Magic Link** and
   make sure the template includes `{{ .Token }}` somewhere (e.g. add a line
   like `Your login code is: {{ .Token }}`). Without this, users who choose
   "Email code" on the sign-in page will receive an email with a link
   instead of the code the page asks them to type in.

## Part 2 — Add your users and assign roles

There's no public "sign up" page in this app on purpose — you control the
list of who can log in.

1. Go to **Authentication → Users → Add user**. Enter their email and set a
   password (or use "Send invite" if you'd rather they set their own).
   Repeat for everyone who needs access.
2. Go to **Table Editor → profiles**. You'll see a row for each user you
   just created (the `role` column defaults to `unassigned`).
3. Click into each row's `role` field and set it to either `internal` or
   `external`, matching which form that person should see.

That's the whole "user list" — anyone left as `unassigned` (or not in the
table) is signed in but blocked from both forms until you set their role.

To revoke someone's access later, delete their user from **Authentication →
Users** (their profile row is removed automatically), or just change their
`role` back to `unassigned`.

## Part 3 — Connect your HTML files to Supabase

1. Open `assets/js/supabase-config.js` in your repo.
2. Replace the two placeholder values with the **Project URL** and
   **anon/publishable key** you copied in Part 1, step 5:

   ```js
   window.SUPABASE_URL = "https://abcdefghijk.supabase.co";
   window.SUPABASE_ANON_KEY = "sb_publishable_xxxxxxxxxxxxxxxx";
   ```

3. Commit and push this change.

## Part 4 — Host the site on GitHub Pages

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Source**, choose **Deploy from a branch**, pick your default
   branch (e.g. `main`) and folder `/ (root)`, then **Save**.
3. GitHub will give you a URL like
   `https://yourusername.github.io/your-repo-name/`. That's now your site,
   with `index.html` (the login page) as the homepage automatically.

(If you'd rather use Netlify or Vercel instead of GitHub Pages, just connect
your GitHub repo there — no other changes needed, since everything is
static files.)

## Part 5 — Test it

1. Visit your GitHub Pages URL. You should land on the login page.
2. Log in as a user you set to `external` → you should land on
   `prequalformcon.html` with a **Log out** button top-right.
3. Log in as a user you set to `internal` → you should land on
   `prequalformint.html`.
4. Try visiting the *other* form's URL directly while logged in — you
   should be automatically redirected to your own correct form.
5. Click **Log out**, then try visiting either form's URL directly while
   signed out — you should be redirected to the login page.

---

## A note on how strong this protection is

The role check happens in the browser (via calls to Supabase), which is the
right approach for a small internal tool like this and is enough to stop
casual/accidental access. It is **not** a hard security boundary the way a
private server-side page would be: the HTML/JS files themselves are still
publicly downloadable from GitHub Pages by anyone who knows the URL, even
though the *page won't function* without a valid, role-matched login (all
real data access goes through Supabase, which enforces the Row Level
Security policy regardless of what the browser does). If these forms will
ever contain information that must never be visible even in page source,
let me know and I can help set up a server-side gate (e.g., a Cloudflare
Worker or Supabase Edge Function that checks the session before serving the
page) instead.
