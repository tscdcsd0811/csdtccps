-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

-- 1. Table that stores each user's access role.
--    id matches auth.users.id, so it's a 1:1 extension of the built-in auth table.
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    role text not null default 'unassigned' check (role in ('internal', 'external', 'unassigned')),
    -- companyid / companyname: set for 'external' users only. Used to
    -- auto-fill the read-only Company Name field on prequalformcon.html
    -- as "companyid - companyname".
    companyid text,
    companyname text,
    -- flname: the user's full name, shown on prequalformint.html to
    -- auto-fill the Interviewer 1 / Examiner 1 name field.
    flname text,
    created_at timestamptz not null default now()
);

-- 2. Lock the table down: enable Row Level Security.
alter table public.profiles enable row level security;

-- 3. A signed-in user may read only their OWN row (needed so the login page /
--    auth guard can look up their role). No insert/update/delete policies are
--    created for regular users on purpose -- only you (via the Table Editor,
--    using the dashboard's service role) can set someone's role.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
    on public.profiles
    for select
    using (auth.uid() = id);

-- 4. Auto-create a profile row whenever a new user is added in Authentication.
--    New users start as 'unassigned' (no access to either form) until you
--    edit their role in Table Editor -> profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'unassigned')
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
