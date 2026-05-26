-- =============================================================
-- Emura Phase 5 Migration: Quote Numbers + Revisions
-- Run in Supabase SQL Editor after schema.sql
-- =============================================================

-- ── Columns ───────────────────────────────────────────────────

alter table quotes
  add column if not exists quote_number    int,
  add column if not exists last_updated_by uuid references auth.users on delete set null;

-- ── quote_revisions ───────────────────────────────────────────

create table if not exists quote_revisions (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  rev_number  int  not null,
  state       jsonb not null,
  created_at  timestamptz default now(),
  created_by  uuid references auth.users on delete set null,
  unique(quote_id, rev_number)
);

alter table quote_revisions enable row level security;

-- same visibility as the parent quote
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

-- ── Auto-assign quote_number on insert ────────────────────────

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
end;
$$;

create or replace trigger assign_quote_number_trigger
  before insert on quotes
  for each row execute function assign_quote_number();

-- ── Backfill quote_number for existing rows ───────────────────

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

-- ── Seed Rev 1 for all existing quotes ────────────────────────

insert into public.quote_revisions (quote_id, rev_number, state, created_at, created_by)
select id, 1, state, created_at, created_by
from public.quotes
on conflict (quote_id, rev_number) do nothing;
