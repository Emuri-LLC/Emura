import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppState, LibraryPart, LibraryEquipment } from './calculations';
import { migrateState } from './state';

// ── Types ─────────────────────────────────────────────────────

export interface OrgContext {
  orgId:        string;
  orgName:      string;
  role:         'admin' | 'estimator' | 'viewer';
  departmentId: string;
}

export interface QuoteSummary {
  id:         string;
  name:       string;
  customer:   string;
  updatedAt:  string;
  createdBy:  string;
}

export interface Site {
  id:   string;
  name: string;
  orgId: string;
}

export interface Department {
  id:     string;
  name:   string;
  siteId: string;
}

export interface OrgMember {
  id:           string;
  userId:       string;
  email:        string;
  role:         'admin' | 'estimator' | 'viewer';
  departmentId: string | null;
}

// ── Org context ───────────────────────────────────────────────

export async function getMyOrgContext(supabase: SupabaseClient): Promise<OrgContext | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, role, department_id, organizations(name)')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  const org = data.organizations as unknown as { name: string } | null;
  return {
    orgId:        data.org_id,
    orgName:      org?.name ?? '',
    role:         data.role as OrgContext['role'],
    departmentId: data.department_id ?? '',
  };
}

// ── Quotes ────────────────────────────────────────────────────

export async function listQuotes(supabase: SupabaseClient): Promise<QuoteSummary[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, name, customer, updated_at, created_by')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map(r => ({
    id:        r.id,
    name:      r.name,
    customer:  r.customer,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
  }));
}

export async function loadQuote(supabase: SupabaseClient, id: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('state')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return migrateState(data.state as Record<string, unknown>);
}

export async function createQuote(
  supabase: SupabaseClient,
  state: AppState,
  departmentId: string,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      department_id: departmentId,
      created_by:    user.id,
      name:          state.quote.name || 'New Quote',
      customer:      state.quote.customer || '',
      state:         state as unknown as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function saveQuote(
  supabase: SupabaseClient,
  id: string,
  state: AppState,
): Promise<void> {
  await supabase
    .from('quotes')
    .update({
      name:     state.quote.name || 'New Quote',
      customer: state.quote.customer || '',
      state:    state as unknown as Record<string, unknown>,
    })
    .eq('id', id);
}

export async function deleteQuote(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('quotes').delete().eq('id', id);
}

// ── Parts & Equipment Library ─────────────────────────────────

export async function listLibraryParts(supabase: SupabaseClient): Promise<LibraryPart[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('id, part_number, description, uom, part_prices(min_qty, unit_cost, source)')
    .order('part_number');

  if (error || !data) return [];

  return data.map(r => ({
    id:          r.id,
    partNumber:  r.part_number,
    description: r.description,
    uom:         r.uom,
    prices: ((r.part_prices as { min_qty: number; unit_cost: number; source: string }[]) ?? [])
      .map(p => ({ minQty: p.min_qty, unitCost: p.unit_cost, source: p.source }))
      .sort((a, b) => a.minQty - b.minQty),
  }));
}

export async function listLibraryEquipment(supabase: SupabaseClient): Promise<LibraryEquipment[]> {
  const { data, error } = await supabase
    .from('equipment_library')
    .select('id, name, capex, hourly_run_cost, annual_maintenance')
    .order('name');

  if (error || !data) return [];

  return data.map(r => ({
    id:                r.id,
    name:              r.name,
    capex:             r.capex,
    hourlyRunCost:     r.hourly_run_cost,
    annualMaintenance: r.annual_maintenance,
  }));
}

// ── Org management ────────────────────────────────────────────

export async function updateOrgName(supabase: SupabaseClient, orgId: string, name: string): Promise<void> {
  await supabase.from('organizations').update({ name }).eq('id', orgId);
}

export async function listSites(supabase: SupabaseClient, orgId: string): Promise<Site[]> {
  const { data } = await supabase
    .from('sites')
    .select('id, name, org_id')
    .eq('org_id', orgId)
    .order('created_at');
  return (data ?? []).map(r => ({ id: r.id, name: r.name, orgId: r.org_id }));
}

export async function addSite(supabase: SupabaseClient, orgId: string, name: string): Promise<Site | null> {
  const { data } = await supabase
    .from('sites')
    .insert({ org_id: orgId, name })
    .select('id, name, org_id')
    .single();
  return data ? { id: data.id, name: data.name, orgId: data.org_id } : null;
}

export async function renameSite(supabase: SupabaseClient, id: string, name: string): Promise<void> {
  await supabase.from('sites').update({ name }).eq('id', id);
}

export async function deleteSite(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('sites').delete().eq('id', id);
}

export async function listDepartments(supabase: SupabaseClient, siteId: string): Promise<Department[]> {
  const { data } = await supabase
    .from('departments')
    .select('id, name, site_id')
    .eq('site_id', siteId)
    .order('created_at');
  return (data ?? []).map(r => ({ id: r.id, name: r.name, siteId: r.site_id }));
}

export async function addDepartment(supabase: SupabaseClient, siteId: string, name: string): Promise<Department | null> {
  const { data } = await supabase
    .from('departments')
    .insert({ site_id: siteId, name })
    .select('id, name, site_id')
    .single();
  return data ? { id: data.id, name: data.name, siteId: data.site_id } : null;
}

export async function renameDepartment(supabase: SupabaseClient, id: string, name: string): Promise<void> {
  await supabase.from('departments').update({ name }).eq('id', id);
}

export async function deleteDepartment(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('departments').delete().eq('id', id);
}

export async function listMembers(supabase: SupabaseClient, orgId: string): Promise<OrgMember[]> {
  // Join org_members with auth.users via a view — Supabase exposes user email
  // through the auth schema only to service role, so we store email at invite time.
  // For existing members use org_invites.email where accepted; fallback to user id display.
  const { data } = await supabase
    .from('org_members')
    .select('id, user_id, role, department_id')
    .eq('org_id', orgId)
    .order('created_at');
  return (data ?? []).map(r => ({
    id:           r.id,
    userId:       r.user_id,
    email:        r.user_id, // resolved to email in AdminDrawer via separate query
    role:         r.role as OrgMember['role'],
    departmentId: r.department_id,
  }));
}

export async function updateMember(
  supabase: SupabaseClient,
  memberId: string,
  role: OrgMember['role'],
  departmentId: string | null,
): Promise<void> {
  await supabase
    .from('org_members')
    .update({ role, department_id: departmentId })
    .eq('id', memberId);
}

export async function removeMember(supabase: SupabaseClient, memberId: string): Promise<void> {
  await supabase.from('org_members').delete().eq('id', memberId);
}

export async function createInvite(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
  role: OrgMember['role'],
  departmentId: string | null,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('org_invites')
    .insert({ org_id: orgId, email, role, department_id: departmentId, created_by: user.id })
    .select('token')
    .single();
  return data?.token ?? null;
}

export async function countDeptQuotes(supabase: SupabaseClient, departmentId: string): Promise<number> {
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', departmentId);
  return count ?? 0;
}
