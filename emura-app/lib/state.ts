import type { AppState } from './calculations';

// ── Storage key ───────────────────────────────────────────────

export const STORE_KEY = 'mce_v4';

// ── Utilities ─────────────────────────────────────────────────

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function parseFraction(v: unknown): number {
  const s = String(v ?? '').trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const num = parseFloat(a), den = parseFloat(b);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return Math.round((num / den) * 10000) / 10000;
    }
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

// ── Default state ─────────────────────────────────────────────

export function defaultState(): AppState {
  return {
    quote: {
      name: 'New Quote',
      customer: '',
      date: new Date().toISOString().slice(0, 10),
      revision: 'A',
      notes: '',
    },
    settings: {
      shopRate: 45,
      indirectRate: 30,
      capexYears: 5,
      workingHoursPerYear: 2000,
    },
    breaks: [
      { id: uid(), label: 'High Vol', buildsPerYear: 12, totalEAU: 0 },
      { id: uid(), label: 'Med Vol',  buildsPerYear: 4,  totalEAU: 0 },
      { id: uid(), label: 'Low Vol',  buildsPerYear: 1,  totalEAU: 0 },
    ],
    finishedGoods: [],
    bom: [],
    materialCosts: {},
    materialSources: {},
    equipment: [],
    directOps: [],
    indirectOps: [],
    subcontracts: [],
    margins: {},
  };
}

// ── Migration ─────────────────────────────────────────────────
// Brings older saved states up to the current schema.

export function migrateState(s: Record<string, unknown>): AppState {
  const state = s as AppState;
  const def = defaultState();

  // Settings defaults
  if (!state.settings) (state as unknown as Record<string, unknown>).settings = {};
  const settings = state.settings as unknown as Record<string, unknown>;
  if (settings.shopRate == null)            settings.shopRate = def.settings.shopRate;
  if (settings.indirectRate == null)        settings.indirectRate = def.settings.indirectRate;
  if (settings.capexYears == null)          settings.capexYears = def.settings.capexYears;
  if (settings.workingHoursPerYear == null) settings.workingHoursPerYear = def.settings.workingHoursPerYear;

  // Breaks
  (state.breaks || []).forEach(b => {
    if (b.totalEAU === undefined) b.totalEAU = 0;
  });

  // BOM: migrate old type field to fgSpecific boolean
  (state.bom || []).forEach(item => {
    const raw = item as unknown as Record<string, unknown>;
    if (item.fgSpecific === undefined) {
      item.fgSpecific = raw['type'] === 'fg-specific';
    }
    delete raw['type'];
    if (item.customerSupplied === undefined) item.customerSupplied = false;
    if (!item.fgQtys) item.fgQtys = {};
  });

  // Equipment
  if (!state.equipment)        state.equipment = [];
  if (!state.margins)          state.margins = {};
  if (!state.materialSources)  state.materialSources = {};

  // Direct ops: migrate old per-op capex to equipment entries
  (state.directOps || []).forEach(op => {
    const raw = op as unknown as Record<string, unknown>;
    delete raw['lineSetupOverrides'];
    if (!op.equipmentIds) {
      op.equipmentIds = [];
      const oldCapex = parseFloat(String(raw['capex'] ?? '0'));
      if (oldCapex > 0) {
        const eq = {
          id: uid(),
          name: op.name || 'Equipment',
          capex: oldCapex,
          hourlyRunCost: 0,
          annualMaintenance: 0,
          projectSpecific: false,
        };
        state.equipment.push(eq);
        op.equipmentIds = [eq.id];
      }
    }
    delete raw['capex'];
  });

  // Indirect ops
  (state.indirectOps || []).forEach(op => {
    const raw = op as unknown as Record<string, unknown>;
    delete raw['lineSetupOverrides'];
  });

  return state;
}

// ── Load from localStorage ────────────────────────────────────

export function loadState(): AppState {
  if (typeof window === 'undefined') return defaultState();
  const keys = [STORE_KEY, 'mce_v3', 'mce_v2', 'mce_v1'];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return migrateState(JSON.parse(raw));
    } catch {
      // corrupted entry — try next key
    }
  }
  return defaultState();
}

// ── Save to localStorage ──────────────────────────────────────

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}
