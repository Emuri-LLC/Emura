-- =============================================================
-- Emura Schema (consolidated — Phases 4 & 5)
-- Single source of truth for a fresh database. Run in the Supabase
-- SQL Editor (Dashboard → SQL Editor → New query). Tables/policies
-- use bare CREATE, so this is an initial-setup script — re-running
-- the whole file against a populated DB will error on existing
-- objects. Functions use CREATE OR REPLACE and the trailing backfill
-- is idempotent, so those blocks can be re-applied individually.
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
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid references departments on delete cascade not null,
  created_by      uuid references auth.users on delete set null,
  last_updated_by uuid references auth.users on delete set null,
  quote_number    int,
  name            text not null default 'New Quote',
  customer        text not null default '',
  state           jsonb not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- quote_revisions: immutable point-in-time snapshots of a quote's state.
create table quote_revisions (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  rev_number  int  not null,
  state       jsonb not null,
  created_at  timestamptz default now(),
  created_by  uuid references auth.users on delete set null,
  unique(quote_id, rev_number)
);

-- ── RLS ───────────────────────────────────────────────────────

alter table organizations enable row level security;
alter table sites         enable row level security;
alter table departments   enable row level security;
alter table org_members   enable row level security;
alter table org_invites   enable row level security;
alter table quotes        enable row level security;
alter table quote_revisions enable row level security;

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

-- quote_revisions: same visibility as the parent quote.
create policy "revisions_select" on quote_revisions for select
  using (exists (
    select 1 from quotes q
    join departments d on d.id = q.department_id
    join sites s on s.id = d.site_id
    join org_members om on om.org_id = s.org_id
    where q.id = quote_revisions.quote_id
      and om.user_id = auth.uid()
      and (om.role = 'admin' or om.department_id = q.department_id)
  ));

create policy "revisions_insert" on quote_revisions for insert
  with check (exists (
    select 1 from quotes q
    join departments d on d.id = q.department_id
    join sites s on s.id = d.site_id
    join org_members om on om.org_id = s.org_id
    where q.id = quote_revisions.quote_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'estimator')
  ));

-- ── Parts & Equipment Library (Phase 5) ──────────────────────

create table if not exists parts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations on delete cascade not null,
  part_number      text not null,
  description      text not null default '',
  uom              text not null default 'EA',
  notes            text not null default '',
  source_quote_id  uuid references public.quotes(id) on delete set null,
  locked           boolean not null default false,
  created_by       uuid references auth.users on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, part_number)
);

-- Migrate existing parts table if columns are missing
alter table public.parts add column if not exists source_quote_id uuid references public.quotes(id) on delete set null;
alter table public.parts add column if not exists locked boolean not null default false;

-- Tiered pricing: one row per part × annual-quantity threshold.
-- min_qty is the annual purchasing quantity at or above which this price applies.
create table if not exists part_prices (
  id         uuid primary key default gen_random_uuid(),
  part_id    uuid references parts on delete cascade not null,
  min_qty    integer not null default 0,
  unit_cost  numeric not null,
  source     text not null default '',
  updated_at timestamptz default now(),
  unique (part_id, min_qty)
);

-- Org-wide equipment reference. site_id = null means all sites.
create table if not exists equipment_library (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid references organizations on delete cascade not null,
  site_id            uuid references sites on delete cascade,
  name               text not null,
  capex              numeric not null default 0,
  hourly_run_cost    numeric not null default 0,
  annual_maintenance numeric not null default 0,
  notes              text not null default '',
  source_quote_id    uuid references public.quotes(id) on delete set null,
  locked             boolean not null default false,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (org_id, name)
);

-- Migrate existing equipment_library table if columns are missing
alter table public.equipment_library add column if not exists source_quote_id uuid references public.quotes(id) on delete set null;
alter table public.equipment_library add column if not exists locked boolean not null default false;

-- Org-wide labor rate reference library
create table if not exists labor_rate_library (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations on delete cascade not null,
  name             text not null,
  rate             numeric not null default 0,
  source_quote_id  uuid references public.quotes(id) on delete set null,
  locked           boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, name)
);

-- Rev note column for revision display in quote selector
alter table public.quote_revisions add column if not exists rev_note text not null default '';

alter table parts               enable row level security;
alter table part_prices         enable row level security;
alter table equipment_library   enable row level security;
alter table labor_rate_library  enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='parts' and policyname='parts_select') then
    create policy "parts_select" on parts for select
      using (exists (select 1 from org_members where org_id = parts.org_id and user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='parts' and policyname='parts_insert') then
    create policy "parts_insert" on parts for insert
      with check (exists (select 1 from org_members where org_id = parts.org_id and user_id = auth.uid() and role in ('admin','estimator')));
  end if;
  if not exists (select 1 from pg_policies where tablename='parts' and policyname='parts_update') then
    create policy "parts_update" on parts for update
      using (exists (select 1 from org_members where org_id = parts.org_id and user_id = auth.uid() and role in ('admin','estimator')));
  end if;
  if not exists (select 1 from pg_policies where tablename='parts' and policyname='parts_delete') then
    create policy "parts_delete" on parts for delete
      using (exists (select 1 from org_members where org_id = parts.org_id and user_id = auth.uid() and role = 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='part_prices' and policyname='part_prices_select') then
    create policy "part_prices_select" on part_prices for select
      using (exists (select 1 from parts p join org_members om on om.org_id = p.org_id where p.id = part_prices.part_id and om.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='part_prices' and policyname='part_prices_write') then
    create policy "part_prices_write" on part_prices for all
      using (exists (select 1 from parts p join org_members om on om.org_id = p.org_id where p.id = part_prices.part_id and om.user_id = auth.uid() and om.role in ('admin','estimator')));
  end if;
  if not exists (select 1 from pg_policies where tablename='equipment_library' and policyname='eqlib_select') then
    create policy "eqlib_select" on equipment_library for select
      using (exists (select 1 from org_members where org_id = equipment_library.org_id and user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='equipment_library' and policyname='eqlib_write') then
    create policy "eqlib_write" on equipment_library for all
      using (exists (select 1 from org_members where org_id = equipment_library.org_id and user_id = auth.uid() and role in ('admin','estimator')));
  end if;
  if not exists (select 1 from pg_policies where tablename='labor_rate_library' and policyname='lrlib_select') then
    create policy "lrlib_select" on labor_rate_library for select
      using (exists (select 1 from org_members where org_id = labor_rate_library.org_id and user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='labor_rate_library' and policyname='lrlib_write') then
    create policy "lrlib_write" on labor_rate_library for all
      using (exists (select 1 from org_members where org_id = labor_rate_library.org_id and user_id = auth.uid() and role in ('admin','estimator')));
  end if;
end $$;

-- ── RPC Functions ─────────────────────────────────────────────

-- Trigger: fires on every new auth.users insert.
-- Reads company_name from user metadata set during signUp().
-- Skips org creation when an active invite exists for that email — the
-- accept_org_invite RPC will add them to the invited org instead.
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_company    text;
  v_org        uuid;
  v_site       uuid;
  v_dept       uuid;
  v_has_invite boolean;
begin
  select exists(
    select 1 from public.org_invites
    where lower(email) = lower(new.email)
      and accepted_at is null
      and expires_at > now()
  ) into v_has_invite;

  if v_has_invite then
    return new;
  end if;

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
-- Uses auth.users lookup (more reliable than auth.jwt()->> in some PKCE flows).
create or replace function accept_org_invite(invite_token text)
returns void language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_invite org_invites;
  v_email  text;
begin
  select email into v_email from auth.users where id = auth.uid();

  select * into v_invite from org_invites
  where token = invite_token
    and accepted_at is null
    and expires_at > now();
  if not found then
    raise exception 'Invalid or expired invite token';
  end if;
  if v_email is null or lower(v_invite.email) <> lower(v_email) then
    raise exception 'Invalid or expired invite token';
  end if;
  insert into org_members (org_id, user_id, role, department_id)
    values (v_invite.org_id, auth.uid(), v_invite.role, v_invite.department_id)
    on conflict (org_id, user_id) do nothing;
  update org_invites set accepted_at = now() where id = v_invite.id;
end; $$;

-- Resolve org members' email addresses from auth.users (otherwise inaccessible
-- to clients). SECURITY DEFINER so it can read auth.users, with row_security off
-- so the members_select RLS policy (user_id = auth.uid()) does not narrow the
-- result to the caller's own row. The explicit membership guard supplies the
-- authorization RLS would otherwise enforce: a caller may only resolve emails
-- for an org they belong to, preventing cross-tenant email enumeration via a
-- guessed/iterated p_org_id. Called on every app load by listMembers / page.tsx.
create or replace function get_org_member_emails(p_org_id uuid)
returns table (user_id uuid, email text)
language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  -- Columns are qualified with the table alias because user_id/email are also
  -- OUT-variable names from the RETURNS TABLE signature; an unqualified column
  -- reference would bind to the (null) variable and the guard would never match.
  if not exists (
    select 1 from public.org_members m
    where m.org_id = p_org_id and m.user_id = auth.uid()
  ) then
    raise exception 'not a member of this org';
  end if;

  return query
    select m.user_id, u.email::text
    from public.org_members m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id;
end; $$;

revoke all on function get_org_member_emails(uuid) from public, anon;
grant execute on function get_org_member_emails(uuid) to authenticated;

-- ── Advanced (content) search over quotes ─────────────────────
-- Extracts searchable text from a quote's state JSONB: estimator notes,
-- BOM part numbers, equipment names, and labor rate names. Marked immutable
-- so it can back an expression index.
create or replace function quote_search_text(s jsonb)
returns text language sql immutable as $$
  select concat_ws(' ',
    coalesce(s->'quote'->>'notes', ''),
    (select string_agg(coalesce(b->>'partNumber', ''), ' ') from jsonb_array_elements(coalesce(s->'bom', '[]'::jsonb)) b),
    (select string_agg(coalesce(e->>'name', ''), ' ') from jsonb_array_elements(coalesce(s->'equipment', '[]'::jsonb)) e),
    (select string_agg(coalesce(r->>'name', ''), ' ') from jsonb_array_elements(coalesce(s->'laborRates', '[]'::jsonb)) r)
  );
$$;

create index if not exists quotes_search_idx on public.quotes
  using gin (to_tsvector('simple', quote_search_text(state)));

-- Returns ids of quotes whose content matches the term (exact-token, 'simple'
-- config). SECURITY INVOKER (default) so the quotes RLS policy scopes results
-- to quotes the caller can already see.
create or replace function search_quotes(p_term text)
returns table(quote_id uuid) language sql stable as $$
  select q.id from public.quotes q
  where p_term is not null and length(trim(p_term)) > 0
    and to_tsvector('simple', quote_search_text(q.state)) @@ plainto_tsquery('simple', p_term);
$$;

-- ── updated_at trigger on quotes ──────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger quotes_updated_at
  before update on quotes
  for each row execute function touch_updated_at();

-- ── Auto-assign quote_number on insert ────────────────────────
-- Sequential per-org quote number, assigned before insert.
create or replace function assign_quote_number()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_org_id uuid;
  v_num    int;
begin
  select s.org_id into v_org_id
  from public.departments d
  join public.sites s on s.id = d.site_id
  where d.id = new.department_id;

  select coalesce(max(q.quote_number), 0) + 1 into v_num
  from public.quotes q
  join public.departments d on d.id = q.department_id
  join public.sites s on s.id = d.site_id
  where s.org_id = v_org_id;

  new.quote_number = v_num;
  return new;
end; $$;

create or replace trigger assign_quote_number_trigger
  before insert on quotes
  for each row execute function assign_quote_number();

-- ── Last-admin guard ──────────────────────────────────────────
-- RLS lets any admin update/delete any org_members row; the AdminDrawer makes
-- the current user's own row read-only in the UI only. This trigger enforces at
-- the DB level (so a direct API call can't bypass it) that an org always keeps
-- at least one admin: it blocks demoting or removing the last remaining admin.
-- security definer + row_security off so the admin count sees all rows, not
-- just the caller's own (members_select restricts to user_id = auth.uid()).
create or replace function prevent_last_admin_change()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_other_admins int;
begin
  -- Only care about an admin losing admin status (demotion or deletion).
  if tg_op = 'UPDATE' and (old.role <> 'admin' or new.role = 'admin') then
    return new;
  end if;
  if tg_op = 'DELETE' and old.role <> 'admin' then
    return old;
  end if;

  select count(*) into v_other_admins
  from public.org_members
  where org_id = old.org_id and role = 'admin' and id <> old.id;

  if v_other_admins = 0 then
    raise exception 'cannot remove or demote the last admin of an org';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end; $$;

create trigger org_members_last_admin
  before update or delete on org_members
  for each row execute function prevent_last_admin_change();

-- ── One-time backfill (idempotent; no-ops on a fresh database) ─
-- Number any pre-existing quotes and seed Rev 1 for each. Both are
-- guarded so re-running the schema does nothing on already-migrated data.
with ranked as (
  select q.id,
    row_number() over (partition by s.org_id order by q.created_at) as rn
  from public.quotes q
  join public.departments d on d.id = q.department_id
  join public.sites s on s.id = d.site_id
)
update public.quotes q2
set quote_number = ranked.rn
from ranked
where q2.id = ranked.id and q2.quote_number is null;

insert into public.quote_revisions (quote_id, rev_number, state, created_at, created_by)
select id, 1, state, created_at, created_by
from public.quotes
on conflict (quote_id, rev_number) do nothing;
