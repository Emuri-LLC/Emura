'use client';

import { useDragSort } from '@/hooks/useDragSort';
import InfoIcon from '@/components/InfoIcon';
import type { AppState, Equipment } from '@/lib/calculations';
import { uid } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
}

export default function EquipmentTab({ state, onUpdate }: Props) {
  const sort = useDragSort(state.equipment, equipment => onUpdate({ ...state, equipment }));

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
                {state.equipment.map((eq, i) => (
                  <tr key={eq.id} {...sort.dragProps(i)} className={sort.rowClass(i)}>
                    <td className="drag-h">&#9776;</td>
                    <td><input type="text" value={eq.name ?? ''} onChange={e => update(i, { name: e.target.value })} /></td>
                    <td><input type="number" min={0} step="any" value={eq.capex || ''} placeholder="0" onChange={e => update(i, { capex: parseFloat(e.target.value) || 0 })} /></td>
                    <td><input type="number" min={0} step="any" value={eq.hourlyRunCost || ''} placeholder="0" onChange={e => update(i, { hourlyRunCost: parseFloat(e.target.value) || 0 })} /></td>
                    <td><input type="number" min={0} step="any" value={eq.annualMaintenance || ''} placeholder="0" onChange={e => update(i, { annualMaintenance: parseFloat(e.target.value) || 0 })} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={eq.projectSpecific ?? false} onChange={e => update(i, { projectSpecific: e.target.checked })} />
                    </td>
                    <td><button className="btn btn-del btn-sm" onClick={() => deleteEquipment(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
