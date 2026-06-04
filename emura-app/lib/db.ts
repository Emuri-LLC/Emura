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
  email:        string; // resolved via get_org_member_emails RPC inside listMembers
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

// Content search across the org's quotes (server-side, JSONB). Matches part
// numbers, equipment names, labor rate names, and estimator notes. Returns the
// ids of matching quotes the caller can access (RLS-scoped via the RPC).
export async function searchQuotes(supabase: SupabaseClient, term: string): Promise<string[]> {
  const t = term.trim();
  if (!t) return [];
  const { data, error } = await supabase.rpc('search_quotes', { p_term: t });
  if (error || !data) return [];
  return (data as { quote_id: string }[]).map(r => r.quote_id);
}

// ── Parts & Equipment Library ─────────────────────────────────

// Upserts all non-customer-supplied BOM items (and their cost entries) from a
// saved quote into the org parts library. Skips items already used in another
// quote (they are "locked" to prevent accidental overwrites).
//
// N+1 elimination: ONE SELECT fetches all existing rows up-front; ONE bulk UPDATE
// marks cross-quote items as locked. Per-item upserts remain (needed to get the
// returned part ID for price tier upserts).
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

  const partNumbers = costable.map(item => item.partNumber.trim());

  // ONE query to fetch all existing rows for the parts we care about
  const { data: existingRows } = await supabase
    .from('parts')
    .select('id, part_number, source_quote_id, locked')
    .eq('org_id', orgId)
    .in('part_number', partNumbers);

  type ExistingRow = { id: string; part_number: string; source_quote_id: string | null; locked: boolean };
  const existingMap = new Map<string, ExistingRow>(
    ((existingRows ?? []) as ExistingRow[]).map(r => [r.part_number, r]),
  );

  // Collect IDs that need to be locked in bulk (different source, not already locked)
  const lockIds: string[] = [];
  for (const item of costable) {
    const pn = item.partNumber.trim();
    const existing = existingMap.get(pn);
    if (existing && !existing.locked && existing.source_quote_id && existing.source_quote_id !== quoteId) {
      lockIds.push(existing.id);
    }
  }

  // ONE bulk UPDATE for all rows that need to be locked
  if (lockIds.length) {
    await supabase.from('parts').update({ locked: true }).in('id', lockIds);
  }

  const lockIdSet = new Set(lockIds);

  for (const item of costable) {
    const pn = item.partNumber.trim();
    const existing = existingMap.get(pn);

    // Skip if already locked or just marked for locking (different source)
    if (existing?.locked) continue;
    if (lockIdSet.has(existing?.id ?? '')) continue;

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

    // annualQty >= 0: a 0 tier is a "standard" flat price that applies at any volume.
    const entries = (state.materialCosts[item.id] ?? []).filter(e => e.annualQty >= 0 && e.cost > 0);
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
//
// N+1 elimination: ONE SELECT fetches all existing rows up-front; ONE bulk UPDATE
// marks cross-quote items as locked.
export async function syncEquipmentToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  quoteId: string,
  state: AppState,
): Promise<void> {
  const named = state.equipment.filter(eq => eq.name.trim());
  if (!named.length) return;

  const names = named.map(eq => eq.name.trim());

  // ONE query to fetch all existing rows for the equipment we care about
  const { data: existingRows } = await supabase
    .from('equipment_library')
    .select('id, name, source_quote_id, locked')
    .eq('org_id', orgId)
    .in('name', names);

  type ExistingEqRow = { id: string; name: string; source_quote_id: string | null; locked: boolean };
  const existingMap = new Map<string, ExistingEqRow>(
    ((existingRows ?? []) as ExistingEqRow[]).map(r => [r.name, r]),
  );

  // Collect IDs that need to be locked in bulk
  const lockIds: string[] = [];
  for (const eq of named) {
    const name = eq.name.trim();
    const existing = existingMap.get(name);
    if (existing && !existing.locked && existing.source_quote_id && existing.source_quote_id !== quoteId) {
      lockIds.push(existing.id);
    }
  }

  // ONE bulk UPDATE for all rows that need to be locked
  if (lockIds.length) {
    await supabase.from('equipment_library').update({ locked: true }).in('id', lockIds);
  }

  const lockIdSet = new Set(lockIds);

  for (const eq of named) {
    const name = eq.name.trim();
    const existing = existingMap.get(name);

    if (existing?.locked) continue;
    if (lockIdSet.has(existing?.id ?? '')) continue;

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

  const valid = entries.filter(e => e.annualQty >= 0 && e.cost > 0);
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

// Makes a library part "standard": replaces all tiered prices with a single flat
// price (min_qty = 0) that applies at any volume. Used to reconcile a part that is
// standard on the quote but still carries stale volume tiers in the library.
export async function makePartStandardInLibrary(
  supabase: SupabaseClient,
  orgId: string,
  partNumber: string,
  description: string,
  uom: string,
  cost: number,
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

  if (error || !partRow) { console.error('[library] makeStandard failed:', error?.message); return; }

  // Drop every existing tier, then write the single flat (min_qty = 0) price.
  const { error: delErr } = await supabase.from('part_prices').delete().eq('part_id', partRow.id);
  if (delErr) { console.error('[library] makeStandard clear failed:', delErr.message); return; }

  if (cost > 0) {
    const { error: insErr } = await supabase
      .from('part_prices')
      .insert({ part_id: partRow.id, min_qty: 0, unit_cost: cost, updated_at: new Date().toISOString() });
    if (insErr) console.error('[library] makeStandard insert failed:', insErr.message);
  }
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

// N+1 elimination: ONE SELECT fetches all existing rows up-front; ONE bulk UPDATE
// marks cross-quote items as locked.
export async function syncLaborRatesToLibrary(
  supabase: SupabaseClient,
  orgId: string,
  quoteId: string,
  state: import('./calculations').AppState,
): Promise<void> {
  const named = (state.laborRates ?? []).filter(r => r.name.trim());
  if (!named.length) return;

  const names = named.map(lr => lr.name.trim());

  // ONE query to fetch all existing rows for the rates we care about
  const { data: existingRows } = await supabase
    .from('labor_rate_library')
    .select('id, name, source_quote_id, locked')
    .eq('org_id', orgId)
    .in('name', names);

  type ExistingRateRow = { id: string; name: string; source_quote_id: string | null; locked: boolean };
  const existingMap = new Map<string, ExistingRateRow>(
    ((existingRows ?? []) as ExistingRateRow[]).map(r => [r.name, r]),
  );

  // Collect IDs that need to be locked in bulk
  const lockIds: string[] = [];
  for (const lr of named) {
    const name = lr.name.trim();
    const existing = existingMap.get(name);
    if (existing && !existing.locked && existing.source_quote_id && existing.source_quote_id !== quoteId) {
      lockIds.push(existing.id);
    }
  }

  // ONE bulk UPDATE for all rows that need to be locked
  if (lockIds.length) {
    await supabase.from('labor_rate_library').update({ locked: true }).in('id', lockIds);
  }

  const lockIdSet = new Set(lockIds);

  for (const lr of named) {
    const name = lr.name.trim();
    const existing = existingMap.get(name);

    if (existing?.locked) continue;
    if (lockIdSet.has(existing?.id ?? '')) continue;

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

// Returns org members with emails resolved via the get_org_member_emails
// security-definer RPC (which can access auth.users). Falls back to a
// truncated userId if the RPC returns no entry for a given user.
export async function listMembers(supabase: SupabaseClient, orgId: string): Promise<OrgMember[]> {
  const [membersResult, emailsResult] = await Promise.all([
    supabase
      .from('org_members')
      .select('id, user_id, role, department_id')
      .eq('org_id', orgId)
      .order('created_at'),
    supabase.rpc('get_org_member_emails', { p_org_id: orgId }),
  ]);

  const emailMap: Record<string, string> = {};
  if (emailsResult.data) {
    (emailsResult.data as { user_id: string; email: string }[]).forEach(r => {
      emailMap[r.user_id] = r.email;
    });
  }

  return (membersResult.data ?? []).map(r => ({
    id:           r.id,
    userId:       r.user_id,
    email:        emailMap[r.user_id] ?? r.user_id,
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
