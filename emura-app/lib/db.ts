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

export interface QuoteRevision {
  id:        string;
  revNumber: number;
  createdAt: string;
  createdBy: string;
  revNote:   string; // state.quote.revision at time of save
}

export interface QuoteSummary {
  id:            string;
  name:          string;
  customer:      string;
  updatedAt:     string;
  createdBy:     string;
  lastUpdatedBy: string;
  quoteNumber:   number;
  revisions:     QuoteRevision[];
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

  // Use limit(1) + maybeSingle instead of single() so that duplicate org_members
  // rows (e.g. trigger-created self-org + invite-accepted org) don't cause a
  // "multiple rows" error. Order by created_at DESC so the invite-accepted row
  // (inserted later) takes precedence over any accidental self-org.
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, role, department_id, organizations(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
    .select('id, name, customer, updated_at, created_by, last_updated_by, quote_number, quote_revisions(id, rev_number, created_at, created_by, rev_note)')
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map(r => {
    const raw = r as unknown as {
      id: string; name: string; customer: string; updated_at: string;
      created_by: string | null; last_updated_by: string | null;
      quote_number: number | null;
      quote_revisions: Array<{ id: string; rev_number: number; created_at: string; created_by: string | null; rev_note: string | null }>;
    };
    const revisions: QuoteRevision[] = (raw.quote_revisions ?? [])
      .map(rv => ({ id: rv.id, revNumber: rv.rev_number, createdAt: rv.created_at, createdBy: rv.created_by ?? '', revNote: rv.rev_note ?? '' }))
      .sort((a, b) => b.revNumber - a.revNumber);
    return {
      id:            raw.id,
      name:          raw.name,
      customer:      raw.customer,
      updatedAt:     raw.updated_at,
      createdBy:     raw.created_by ?? '',
      lastUpdatedBy: raw.last_updated_by ?? raw.created_by ?? '',
      quoteNumber:   raw.quote_number ?? 0,
      revisions,
    };
  });
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
): Promise<{ id: string; quoteNumber: number } | null> {
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
    .select('id, quote_number')
    .single();

  if (error || !data) return null;
  return { id: data.id, quoteNumber: (data as unknown as { quote_number: number }).quote_number ?? 0 };
}

export async function saveQuote(
  supabase: SupabaseClient,
  id: string,
  state: AppState,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase
    .from('quotes')
    .update({
      name:            state.quote.name || 'New Quote',
      customer:        state.quote.customer || '',
      state:           state as unknown as Record<string, unknown>,
      updated_at:      new Date().toISOString(),
      last_updated_by: user?.id ?? null,
    })
    .eq('id', id);
}

export async function saveRevision(
  supabase: SupabaseClient,
  quoteId: string,
  state: AppState,
): Promise<QuoteRevision | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: top } = await supabase
    .from('quote_revisions')
    .select('rev_number')
    .eq('quote_id', quoteId)
    .order('rev_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNum = ((top as { rev_number: number } | null)?.rev_number ?? 0) + 1;

  const { data, error } = await supabase
    .from('quote_revisions')
    .insert({
      quote_id:   quoteId,
      rev_number: nextNum,
      state:      state as unknown as Record<string, unknown>,
      created_by: user.id,
      rev_note:   state.quote.revision ?? '',
    })
    .select('id, rev_number, created_at, created_by, rev_note')
    .single();

  if (error || !data) return null;
  const r = data as unknown as { id: string; rev_number: number; created_at: string; created_by: string | null; rev_note: string | null };
  return { id: r.id, revNumber: r.rev_number, createdAt: r.created_at, createdBy: r.created_by ?? '', revNote: r.rev_note ?? '' };
}

export async function loadQuoteRevision(
  supabase: SupabaseClient,
  revisionId: string,
): Promise<AppState | null> {
  const { data, error } = await supabase
    .from('quote_revisions')
    .select('state')
    .eq('id', revisionId)
    .single();

  if (error || !data) return null;
  return migrateState(data.state as Record<string, unknown>);
}

export async function deleteQuote(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('quotes').delete().eq('id', id);
}

// ── Parts & Equipment Library ─────────────────────────────────

// Upserts all non-customer-supplied BOM items (and their cost entries) from a
// saved quote into the org parts library. Skips items already used in another
// quote (they are "locked" to prevent accidental overwrites).
export async function syncPartsToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  quoteId: string,
  state: AppState,
): Promise<void> {
  const costable = state.bom.filter(
    item => !item.customerSupplied && item.partNumber.trim(),
  );
  if (!costable.length) return;

  for (const item of costable) {
    const pn = item.partNumber.trim();

    const { data: existing } = await supabase
      .from('parts')
      .select('id, source_quote_id, locked')
      .eq('org_id', orgId)
      .eq('part_number', pn)
      .maybeSingle();

    if (existing?.locked) continue;

    if (existing?.source_quote_id && existing.source_quote_id !== quoteId) {
      await supabase.from('parts').update({ locked: true }).eq('id', existing.id);
      continue;
    }

    const { data: partRow, error: partErr } = await supabase
      .from('parts')
      .upsert(
        {
          org_id:          orgId,
          part_number:     pn,
          description:     item.description || '',
          uom:             item.uom || 'EA',
          source_quote_id: quoteId,
          locked:          false,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'org_id,part_number' },
      )
      .select('id')
      .single();

    if (partErr) { console.error('[library] part upsert failed:', partErr.message); continue; }
    if (!partRow) continue;

    const entries = (state.materialCosts[item.id] ?? []).filter(e => e.annualQty > 0 && e.cost > 0);
    if (!entries.length) continue;

    const { error: priceErr } = await supabase
      .from('part_prices')
      .upsert(
        entries.map(e => ({
          part_id:    partRow.id,
          min_qty:    Math.round(e.annualQty),
          unit_cost:  e.cost,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'part_id,min_qty' },
      );

    if (priceErr) console.error('[library] part_prices upsert failed:', priceErr.message);
  }
}

// Upserts equipment from a quote into the org equipment library. Skips
// equipment already used in another quote (locked).
export async function syncEquipmentToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  quoteId: string,
  state: AppState,
): Promise<void> {
  const named = state.equipment.filter(eq => eq.name.trim());
  if (!named.length) return;

  for (const eq of named) {
    const name = eq.name.trim();

    const { data: existing } = await supabase
      .from('equipment_library')
      .select('id, source_quote_id, locked')
      .eq('org_id', orgId)
      .eq('name', name)
      .maybeSingle();

    if (existing?.locked) continue;

    if (existing?.source_quote_id && existing.source_quote_id !== quoteId) {
      await supabase.from('equipment_library').update({ locked: true }).eq('id', existing.id);
      continue;
    }

    const { error } = await supabase
      .from('equipment_library')
      .upsert(
        {
          org_id:             orgId,
          name,
          capex:              eq.capex,
          hourly_run_cost:    eq.hourlyRunCost,
          annual_maintenance: eq.annualMaintenance,
          source_quote_id:    quoteId,
          locked:             false,
          updated_at:         new Date().toISOString(),
        },
        { onConflict: 'org_id,name' },
      );

    if (error) console.error('[library] equipment upsert failed:', error.message);
  }
}

// Force-pushes a single part (and its price tiers) from a quote to the library,
// bypassing the lock. Used by the "→ Update Library" button in Quote Review.
export async function pushPartToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  partNumber: string,
  description: string,
  uom: string,
  entries: { annualQty: number; cost: number }[],
): Promise<void> {
  const { data: partRow, error } = await supabase
    .from('parts')
    .upsert(
      {
        org_id:      orgId,
        part_number: partNumber.trim(),
        description: description || '',
        uom:         uom || 'EA',
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'org_id,part_number' },
    )
    .select('id')
    .single();

  if (error || !partRow) { console.error('[library] pushPart failed:', error?.message); return; }

  const valid = entries.filter(e => e.annualQty > 0 && e.cost > 0);
  if (!valid.length) return;

  const { error: priceErr } = await supabase
    .from('part_prices')
    .upsert(
      valid.map(e => ({
        part_id:    partRow.id,
        min_qty:    Math.round(e.annualQty),
        unit_cost:  e.cost,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'part_id,min_qty' },
    );

  if (priceErr) console.error('[library] pushPart prices failed:', priceErr.message);
}

// Force-pushes a single equipment entry to the library, bypassing the lock.
export async function pushEquipmentToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
  capex: number,
  hourlyRunCost: number,
  annualMaintenance: number,
): Promise<void> {
  const { error } = await supabase
    .from('equipment_library')
    .upsert(
      {
        org_id:             orgId,
        name:               name.trim(),
        capex,
        hourly_run_cost:    hourlyRunCost,
        annual_maintenance: annualMaintenance,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: 'org_id,name' },
    );

  if (error) console.error('[library] pushEquipment failed:', error.message);
}

export async function listLibraryParts(supabase: SupabaseClient): Promise<LibraryPart[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('id, part_number, description, uom, locked, part_prices(min_qty, unit_cost, source)')
    .order('part_number');

  if (error || !data) return [];

  return data.map(r => ({
    id:          r.id,
    partNumber:  r.part_number,
    description: r.description,
    uom:         r.uom,
    locked:      r.locked ?? false,
    prices: ((r.part_prices as { min_qty: number; unit_cost: number; source: string }[]) ?? [])
      .map(p => ({ minQty: p.min_qty, unitCost: p.unit_cost, source: p.source }))
      .sort((a, b) => a.minQty - b.minQty),
  }));
}

export async function listLibraryEquipment(supabase: SupabaseClient): Promise<LibraryEquipment[]> {
  const { data, error } = await supabase
    .from('equipment_library')
    .select('id, name, capex, hourly_run_cost, annual_maintenance, locked')
    .order('name');

  if (error || !data) return [];

  return data.map(r => ({
    id:                r.id,
    name:              r.name,
    capex:             r.capex,
    hourlyRunCost:     r.hourly_run_cost,
    annualMaintenance: r.annual_maintenance,
    locked:            r.locked ?? false,
  }));
}

// ── Labor Rate Library ────────────────────────────────────────

export async function listLibraryLaborRates(supabase: SupabaseClient): Promise<import('./calculations').LibraryLaborRate[]> {
  const { data, error } = await supabase
    .from('labor_rate_library')
    .select('id, name, rate, locked')
    .order('name');
  if (error || !data) return [];
  return (data as { id: string; name: string; rate: number; locked: boolean }[]).map(r => ({
    id: r.id, name: r.name, rate: r.rate, locked: r.locked ?? false,
  }));
}

export async function syncLaborRatesToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  quoteId: string,
  state: import('./calculations').AppState,
): Promise<void> {
  const named = (state.laborRates ?? []).filter(r => r.name.trim());
  if (!named.length) return;

  for (const lr of named) {
    const name = lr.name.trim();
    const { data: existing } = await supabase
      .from('labor_rate_library')
      .select('id, source_quote_id, locked')
      .eq('org_id', orgId)
      .eq('name', name)
      .maybeSingle();

    if (existing?.locked) continue;

    if (existing?.source_quote_id && existing.source_quote_id !== quoteId) {
      await supabase.from('labor_rate_library').update({ locked: true }).eq('id', existing.id);
      continue;
    }

    const { error } = await supabase
      .from('labor_rate_library')
      .upsert(
        { org_id: orgId, name, rate: lr.rate, source_quote_id: quoteId, locked: false, updated_at: new Date().toISOString() },
        { onConflict: 'org_id,name' },
      );
    if (error) console.error('[library] laborRate upsert failed:', error.message);
  }
}

export async function pushLaborRateToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
  rate: number,
): Promise<void> {
  const { error } = await supabase
    .from('labor_rate_library')
    .upsert(
      { org_id: orgId, name: name.trim(), rate, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,name' },
    );
  if (error) console.error('[library] pushLaborRate failed:', error.message);
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
