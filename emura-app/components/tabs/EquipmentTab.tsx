'use client';

import { useState, useRef } from 'react';
import { useDragSort } from '@/hooks/useDragSort';
import { TIPS } from '@/components/InfoIcon';
import SectionCard from '@/components/mcx/SectionCard';
import NumX from '@/components/mcx/NumX';
import Icon from '@/components/mcx/Icon';
import { Grip, Chk, Note, HelpI } from '@/components/mcx/primitives';
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
        className="mcx-input is-mono"
        style={{ width: 150 }}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); if (e.target.value.length > 0) openMenu(); else setOpen(false); }}
        onFocus={() => { if (query.length > 0) openMenu(); }}
        onBlur={() => { setTimeout(() => { setOpen(false); onCommit(query); }, 150); }}
        autoComplete="off"
      />
      {open && libMatches.length > 0 && (
        <div className="eq-menu mcx-menu" style={menuStyle}>
          {libMatches.map(le => (
            <div key={le.id} className="eq-item">
              <label onMouseDown={e => e.preventDefault()} onClick={() => {
                setQuery(le.name);
                setOpen(false);
                onCommit(le.name, { capex: le.capex, hourlyRunCost: le.hourlyRunCost, annualMaintenance: le.annualMaintenance });
              }}>
                <span className="mono">{le.name}</span>
                {le.locked && <span style={{ fontSize: 10, color: 'var(--warn)' }}>locked</span>}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ok-2)' }}>← copy</span>
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
    const directOps = state.directOps.map(op => ({ ...op, equipmentIds: (op.equipmentIds || []).filter(id => id !== eqId) }));
    onUpdate({ ...state, equipment, directOps });
  }

  return (
    <SectionCard icon="gear" title="Equipment & Tooling" sub="— assigned to operations on the Operations tab" action="Add Equipment" onAction={addEquipment} bodyPad={false}>
      {state.equipment.length === 0 && <div style={{ padding: 16 }}><Note kind="accent">No equipment defined yet.</Note></div>}
      {state.equipment.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="mcx-table">
            <thead><tr>
              <th style={{ width: 26 }} />
              <th>Name <HelpI tip={TIPS.eqName} /></th>
              <th className="ta-r">CapEx ($) <HelpI tip={TIPS.eqCapex} /></th>
              <th className="ta-r">Run Cost ($/hr) <HelpI tip={TIPS.eqRun} /></th>
              <th className="ta-r">Annual Maint. ($) <HelpI tip={TIPS.eqMaint} /></th>
              <th className="ta-c">Project-Specific <HelpI tip={TIPS.eqProj} /></th>
              <th style={{ width: 40 }} />
            </tr></thead>
            <tbody>
              {state.equipment.map((eq, i) => {
                const rowKey = (localResetKeys[eq.id] ?? 0);
                return (
                  <tr key={eq.id} {...sort.dragProps(i)} className={sort.rowClass(i)}>
                    <td className="drag-h"><Grip /></td>
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
                    <td className="ta-r"><NumX value={eq.capex || 0} min={0} blankZero suffix="$" width={110} key={eq.id + '-capex-' + resetKey + '-' + rowKey} onCommit={v => update(i, { capex: v })} /></td>
                    <td className="ta-r"><NumX value={eq.hourlyRunCost || 0} min={0} blankZero suffix="$" width={100} key={eq.id + '-run-' + resetKey + '-' + rowKey} onCommit={v => update(i, { hourlyRunCost: v })} /></td>
                    <td className="ta-r"><NumX value={eq.annualMaintenance || 0} min={0} blankZero suffix="$" width={110} key={eq.id + '-maint-' + resetKey + '-' + rowKey} onCommit={v => update(i, { annualMaintenance: v })} /></td>
                    <td className="ta-c"><Chk on={eq.projectSpecific ?? false} onChange={v => update(i, { projectSpecific: v })} /></td>
                    <td className="ta-c"><button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteEquipment(i)}><Icon name="x" size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '12px 16px' }}>
        <Note kind="accent"><b>Project-Specific</b> spreads cost over EAU rather than utilization %. Utilization = (cycle hrs × annual units + setup hrs × builds/yr …) ÷ working hrs/yr.</Note>
      </div>
    </SectionCard>
  );
}
