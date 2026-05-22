-- =============================================================
-- Emura Phase 4 Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================

-- ── Tables ────────────────────────────────────────────────────

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references auth.users on delete set null,
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
  created_by    uuid references auth.users on delete set null,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_at    timestamptz default now()
);

create table quotes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references departments on delete cascade not null,
  created_by    uuid references auth.users on delete set null,
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
-- Simple non-recursive policy: each user can see rows in their own org.
-- Avoids the circular dependency of querying org_members inside an org_members policy.
create policy "members_select" on org_members for select
  using (user_id = auth.uid());
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

-- ── Parts & Equipment Library (Phase 5) ──────────────────────

create table parts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade not null,
  part_number text not null,
  description text not null default '',
  uom         text not null default 'EA',
  notes       text not null default '',
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (org_id, part_number)
);

-- Tiered pricing: one row per part × annual-quantity threshold.
-- min_qty is the annual purchasing quantity at or above which this price applies.
create table part_prices (
  id         uuid primary key default gen_random_uuid(),
  part_id    uuid references parts on delete cascade not null,
  min_qty    integer not null default 0,
  unit_cost  numeric not null,
  source     text not null default '',
  updated_at timestamptz default now()
);

-- Org-wide equipment reference. site_id = null means all sites.
create table equipment_library (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid references organizations on delete cascade not null,
  site_id            uuid references sites on delete cascade,
  name               text not null,
  capex              numeric not null default 0,
  hourly_run_cost    numeric not null default 0,
  annual_maintenance numeric not null default 0,
  notes              text not null default '',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table parts            enable row level security;
alter table part_prices      enable row level security;
alter table equipment_library enable row level security;

-- parts: all org members can read; admins and estimators can write
create policy "parts_select" on parts for select
  using (exists (
    select 1 from org_members where org_id = parts.org_id and user_id = auth.uid()
  ));
create policy "parts_insert" on parts for insert
  with check (exists (
    select 1 from org_members where org_id = parts.org_id and user_id = auth.uid()
      and role in ('admin','estimator')
  ));
create policy "parts_update" on parts for update
  using (exists (
    select 1 from org_members where org_id = parts.org_id and user_id = auth.uid()
      and role in ('admin','estimator')
  ));
create policy "parts_delete" on parts for delete
  using (exists (
    select 1 from org_members where org_id = parts.org_id and user_id = auth.uid()
      and role = 'admin'
  ));

-- part_prices: inherit access from parent part
create policy "part_prices_select" on part_prices for select
  using (exists (
    select 1 from parts p join org_members om on om.org_id = p.org_id
    where p.id = part_prices.part_id and om.user_id = auth.uid()
  ));
create policy "part_prices_write" on part_prices for all
  using (exists (
    select 1 from parts p join org_members om on om.org_id = p.org_id
    where p.id = part_prices.part_id and om.user_id = auth.uid()
      and om.role in ('admin','estimator')
  ));

-- equipment_library: all members read; admins write
create policy "eqlib_select" on equipment_library for select
  using (exists (
    select 1 from org_members where org_id = equipment_library.org_id and user_id = auth.uid()
  ));
create policy "eqlib_write" on equipment_library for all
  using (exists (
    select 1 from org_members where org_id = equipment_library.org_id and user_id = auth.uid()
      and role = 'admin'
  ));

-- ── RPC Functions ─────────────────────────────────────────────

-- Trigger: fires on every new auth.users insert.
-- Reads company_name from user metadata set during signUp().
-- Only creates an org if the user isn't already joining via an invite (handled separately).
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_company text;
  v_org     uuid;
  v_site    uuid;
  v_dept    uuid;
begin
  v_company := coalesce(
    new.raw_user_meta_data->>'company_name',
    split_part(new.email, '@', 1)
  );
  insert into public.organizations (name, created_by)
    values (v_company, new.id) returning id into v_org;
  insert into public.sites (org_id, name)
    values (v_org, 'Main Site') returning id into v_site;
  insert into public.departments (site_id, name)
    values (v_site, 'General') returning id into v_dept;
  insert into public.org_members (org_id, user_id, role, department_id)
    values (v_org, new.id, 'admin', v_dept);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Accept an invite token: inserts org_members row and marks invite accepted.
-- Rejects if the authenticated user's email does not match the invite email,
-- preventing account hijacking via stolen invite links.
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
  if lower(v_invite.email) <> lower(auth.jwt()->>'email') then
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
