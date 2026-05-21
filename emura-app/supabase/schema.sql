-- =============================================================
-- Emura Phase 4 Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================

-- ── Tables ────────────────────────────────────────────────────

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users not null,
  created_at  timestamptz default now()
);

create table sites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

create table departments (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid references sites on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

create table org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations on delete cascade not null,
  user_id       uuid references auth.users on delete cascade not null,
  role          text not null check (role in ('admin','estimator','viewer')),
  department_id uuid references departments,
  created_at    timestamptz default now(),
  unique(org_id, user_id)
);

create table org_invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations on delete cascade not null,
  email         text not null,
  role          text not null check (role in ('admin','estimator','viewer')),
  department_id uuid references departments,
  token         text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_by    uuid references auth.users not null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz default now()
);

create table quotes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references departments on delete cascade not null,
  created_by    uuid references auth.users not null,
  name          text not null default 'New Quote',
  customer      text not null default '',
  state         jsonb not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────

alter table organizations enable row level security;
alter table sites         enable row level security;
alter table departments   enable row level security;
alter table org_members   enable row level security;
alter table org_invites   enable row level security;
alter table quotes        enable row level security;

-- organizations: readable/writable by members of that org (admin writes)
create policy "orgs_select" on organizations for select
  using (exists (
    select 1 from org_members where org_id = organizations.id and user_id = auth.uid()
  ));
create policy "orgs_update" on organizations for update
  using (exists (
    select 1 from org_members where org_id = organizations.id and user_id = auth.uid() and role = 'admin'
  ));

-- sites: readable by org members; writable by admins
create policy "sites_select" on sites for select
  using (exists (
    select 1 from org_members where org_id = sites.org_id and user_id = auth.uid()
  ));
create policy "sites_insert" on sites for insert
  with check (exists (
    select 1 from org_members where org_id = sites.org_id and user_id = auth.uid() and role = 'admin'
  ));
create policy "sites_update" on sites for update
  using (exists (
    select 1 from org_members where org_id = sites.org_id and user_id = auth.uid() and role = 'admin'
  ));
create policy "sites_delete" on sites for delete
  using (exists (
    select 1 from org_members where org_id = sites.org_id and user_id = auth.uid() and role = 'admin'
  ));

-- departments: readable by org members; writable by admins
create policy "depts_select" on departments for select
  using (exists (
    select 1 from org_members om
    join sites s on s.id = departments.site_id
    where om.org_id = s.org_id and om.user_id = auth.uid()
  ));
create policy "depts_insert" on departments for insert
  with check (exists (
    select 1 from org_members om
    join sites s on s.id = departments.site_id
    where om.org_id = s.org_id and om.user_id = auth.uid() and om.role = 'admin'
  ));
create policy "depts_update" on departments for update
  using (exists (
    select 1 from org_members om
    join sites s on s.id = departments.site_id
    where om.org_id = s.org_id and om.user_id = auth.uid() and om.role = 'admin'
  ));
create policy "depts_delete" on departments for delete
  using (exists (
    select 1 from org_members om
    join sites s on s.id = departments.site_id
    where om.org_id = s.org_id and om.user_id = auth.uid() and om.role = 'admin'
  ));

-- org_members: readable by org members; writable by admins
create policy "members_select" on org_members for select
  using (exists (
    select 1 from org_members om2 where om2.org_id = org_members.org_id and om2.user_id = auth.uid()
  ));
create policy "members_insert" on org_members for insert
  with check (exists (
    select 1 from org_members om2 where om2.org_id = org_members.org_id and om2.user_id = auth.uid() and om2.role = 'admin'
  ));
create policy "members_update" on org_members for update
  using (exists (
    select 1 from org_members om2 where om2.org_id = org_members.org_id and om2.user_id = auth.uid() and om2.role = 'admin'
  ));
create policy "members_delete" on org_members for delete
  using (exists (
    select 1 from org_members om2 where om2.org_id = org_members.org_id and om2.user_id = auth.uid() and om2.role = 'admin'
  ));

-- org_invites: admins can read/insert; any authenticated user can accept their own token
create policy "invites_select" on org_invites for select
  using (exists (
    select 1 from org_members where org_id = org_invites.org_id and user_id = auth.uid() and role = 'admin'
  ));
create policy "invites_insert" on org_invites for insert
  with check (exists (
    select 1 from org_members where org_id = org_invites.org_id and user_id = auth.uid() and role = 'admin'
  ));

-- quotes: admins see all org quotes; estimators/viewers see their department only
create policy "quotes_select" on quotes for select
  using (exists (
    select 1 from org_members om
    join departments d on d.id = quotes.department_id
    join sites s on s.id = d.site_id
    where om.user_id = auth.uid()
      and om.org_id = s.org_id
      and (om.role = 'admin' or om.department_id = quotes.department_id)
  ));
create policy "quotes_insert" on quotes for insert
  with check (exists (
    select 1 from org_members om
    join departments d on d.id = quotes.department_id
    join sites s on s.id = d.site_id
    where om.user_id = auth.uid()
      and om.org_id = s.org_id
      and om.role in ('admin','estimator')
  ));
create policy "quotes_update" on quotes for update
  using (exists (
    select 1 from org_members om
    join departments d on d.id = quotes.department_id
    join sites s on s.id = d.site_id
    where om.user_id = auth.uid()
      and om.org_id = s.org_id
      and om.role in ('admin','estimator')
  ));
create policy "quotes_delete" on quotes for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from org_members om
      join departments d on d.id = quotes.department_id
      join sites s on s.id = d.site_id
      where om.user_id = auth.uid()
        and om.org_id = s.org_id
        and om.role = 'admin'
    )
  );

-- ── RPC Functions ─────────────────────────────────────────────

-- Called once after signup: creates org + Main Site + General dept + admin membership
create or replace function create_org_for_new_user(org_name text)
returns uuid language plpgsql security definer as $$
declare
  v_org  uuid;
  v_site uuid;
  v_dept uuid;
begin
  insert into organizations (name, created_by)
    values (org_name, auth.uid()) returning id into v_org;
  insert into sites (org_id, name)
    values (v_org, 'Main Site') returning id into v_site;
  insert into departments (site_id, name)
    values (v_site, 'General') returning id into v_dept;
  insert into org_members (org_id, user_id, role, department_id)
    values (v_org, auth.uid(), 'admin', v_dept);
  return v_org;
end; $$;

-- Accept an invite token: inserts org_members row and marks invite accepted
create or replace function accept_org_invite(invite_token text)
returns void language plpgsql security definer as $$
declare
  v_invite org_invites;
begin
  select * into v_invite from org_invites
  where token = invite_token
    and accepted_at is null
    and expires_at > now();
  if not found then
    raise exception 'Invalid or expired invite token';
  end if;
  insert into org_members (org_id, user_id, role, department_id)
    values (v_invite.org_id, auth.uid(), v_invite.role, v_invite.department_id)
    on conflict (org_id, user_id) do nothing;
  update org_invites set accepted_at = now() where id = v_invite.id;
end; $$;

-- ── updated_at trigger on quotes ──────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger quotes_updated_at
  before update on quotes
  for each row execute function touch_updated_at();
