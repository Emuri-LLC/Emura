'use client';

import { useState, useRef } from 'react';
import { useDragSort } from '@/hooks/useDragSort';
import InfoIcon from '@/components/InfoIcon';
import type { AppState, Equipment, LibraryEquipment } from '@/lib/calculations';
import { uid } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  resetKey?: number;
  libraryEquipment?: LibraryEquipment[];
}

// ── Equipment name input with library autocomplete ────────────

function EquipmentNameInput({ value, libraryEquipment, onCommit }: {
  value: string;
  libraryEquipment: LibraryEquipment[];
  onCommit: (name: string, extra?: { capex: number; hourlyRunCost: number; annualMaintenance: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  function openMenu() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed', top: r.bottom + 2, left: r.left, width: Math.max(220, r.width), zIndex: 9999 });
    setOpen(true);
  }

  const libMatches = query.length > 0
    ? libraryEquipment.filter(le => le.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); if (e.target.value.length > 0) setOpen(true); else setOpen(false); }}
        onFocus={() => { if (query.length > 0) openMenu(); }}
        onBlur={() => { setTimeout(() => { setOpen(false); onCommit(query); }, 150); }}
        autoComplete="off"
      />
      {open && libMatches.length > 0 && (
        <div className="eq-menu" style={menuStyle}>
          {libMatches.map(le => (
            <div key={le.id} className="eq-item">
              <label onMouseDown={e => e.preventDefault()} onClick={() => {
                setQuery(le.name);
                setOpen(false);
                onCommit(le.name, { capex: le.capex, hourlyRunCost: le.hourlyRunCost, annualMaintenance: le.annualMaintenance });
              }}>
                {le.name}
                {le.locked && <span style={{ marginLeft: 4, fontSize: 10, color: '#c2410c' }}>locked</span>}
                <span style={{ marginLeft: 6, fontSize: 10, color: '#166534' }}>← copy</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EquipmentTab({ state, onUpdate, resetKey = 0, libraryEquipment = [] }: Props) {
  const sort = useDragSort(state.equipment, equipment => onUpdate({ ...state, equipment }));
  // Per-row reset keys so library-fill can refresh defaultValue inputs
  const [localResetKeys, setLocalResetKeys] = useState<Record<string, number>>({});

  function update(i: number, patch: Partial<Equipment>) {
    onUpdate({ ...state, equipment: state.equipment.map((eq, idx) => idx === i ? { ...eq, ...patch } : eq) });
  }

  function addEquipment() {
    onUpdate({ ...state, equipment: [...state.equipment, { id: uid(), name: '', capex: 0, hourlyRunCost: 0, annualMaintenance: 0, projectSpecific: false }] });
  }

  function deleteEquipment(i: number) {
    const eqId = state.equipment[i].id;
    const equipment = state.equipment.filter((_, idx) => idx !== i);
    const directOps = state.directOps.map(op => ({
      ...op,
      equipmentIds: (op.equipmentIds || []).filter(id => id !== eqId),
    }));
    onUpdate({ ...state, equipment, directOps });
  }

  return (
    <div className="card">
      <div className="card-hdr">
        Equipment
        <button className="btn btn-add btn-sm" onClick={addEquipment}>+ Add Equipment</button>
      </div>
      <div className="card-body">
        <div className="inline-info">
          Define equipment used in operations. Assign to operations on the Operations tab.<br />
          <b>Project-Specific</b>: spreads cost over EAU rather than utilization %.
          Utilization = (cycle hrs × annual units + order setup hrs × builds/yr + line setup hrs × builds/yr × FG count) ÷ working hrs/yr.
        </div>

        {state.equipment.length === 0 && <p className="empty-msg">No equipment defined.</p>}
        {state.equipment.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>
                <th></th>
                <th>Name <InfoIcon k="eqName" /></th>
                <th>CapEx ($) <InfoIcon k="eqCapex" /></th>
                <th>Run Cost ($/hr) <InfoIcon k="eqRun" /></th>
                <th>Annual Maint. ($) <InfoIcon k="eqMaint" /></th>
                <th style={{ textAlign: 'center' }}>Project-Specific <InfoIcon k="eqProj" /></th>
                <th></th>
              </tr></thead>
              <tbody>
                {state.equipment.map((eq, i) => {
                  const rowKey = (localResetKeys[eq.id] ?? 0);
                  return (
                    <tr key={eq.id} {...sort.dragProps(i)} className={sort.rowClass(i)}>
                      <td className="drag-h">&#9776;</td>
                      <td>
                        <EquipmentNameInput
                          value={eq.name ?? ''}
                          libraryEquipment={libraryEquipment}
                          onCommit={(name, extra) => {
                            if (extra) {
                              onUpdate({ ...state, equipment: state.equipment.map((e, idx) => idx === i ? { ...e, name, capex: extra.capex, hourlyRunCost: extra.hourlyRunCost, annualMaintenance: extra.annualMaintenance } : e) });
                              setLocalResetKeys(prev => ({ ...prev, [eq.id]: (prev[eq.id] ?? 0) + 1 }));
                            } else {
                              update(i, { name });
                            }
                          }}
                        />
                      </td>
                      <td><input type="number" min={0} step="any" placeholder="0" key={eq.id + '-capex-' + resetKey + '-' + rowKey} defaultValue={eq.capex || ''} onBlur={e => update(i, { capex: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" placeholder="0" key={eq.id + '-run-' + resetKey + '-' + rowKey} defaultValue={eq.hourlyRunCost || ''} onBlur={e => update(i, { hourlyRunCost: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" min={0} step="any" placeholder="0" key={eq.id + '-maint-' + resetKey + '-' + rowKey} defaultValue={eq.annualMaintenance || ''} onBlur={e => update(i, { annualMaintenance: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={eq.projectSpecific ?? false} onChange={e => update(i, { projectSpecific: e.target.checked })} />
                      </td>
                      <td><button className="btn btn-del btn-sm" onClick={() => deleteEquipment(i)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
