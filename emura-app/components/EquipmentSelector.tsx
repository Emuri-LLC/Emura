'use client';

import { useState, useRef } from 'react';
import type { Equipment } from '@/lib/calculations';

interface Props {
  selectedIds: string[];
  equipment: Equipment[];
  onChange: (ids: string[]) => void;
  onCreateEquipment: (name: string) => void;
}

function isDefined(eq: Equipment) {
  return eq.capex > 0 || eq.hourlyRunCost > 0 || eq.annualMaintenance > 0;
}

export default function EquipmentSelector({
  selectedIds, equipment, onChange, onCreateEquipment,
}: Props) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  function openMenu() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed', top: r.bottom + 2, left: r.left,
      width: Math.max(200, r.width), zIndex: 9999 });
    setOpen(true);
  }

  function toggle(id: string) {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id]);
  }

  function createNew() {
    const name = query.trim();
    if (!name) return;
    onCreateEquipment(name);
    setQuery('');
    setOpen(false);
  }

  const filtered = equipment.filter(eq =>
    !query || eq.name.toLowerCase().includes(query.toLowerCase())
  );
  const exactMatch = equipment.some(eq =>
    eq.name.toLowerCase() === query.toLowerCase()
  );
  const showCreate = query.length > 0 && !exactMatch;

  return (
    <div className="eq-dd">
      {/* Selected chips */}
      <div className="eq-chips">
        {selectedIds.map(id => {
          const eq = equipment.find(e => e.id === id);
          if (!eq) return null;
          const ok = isDefined(eq);
          return (
            <span key={id}
              className={`eq-chip${ok ? '' : ' eq-chip-warn'}`}
              title={ok ? undefined : 'No attributes defined on Equipment tab'}
            >
              {eq.name}{ok ? '' : ' ⚠'}
              <button type="button"
                onClick={() => onChange(selectedIds.filter(i => i !== id))}>
                ×
              </button>
            </span>
          );
        })}
      </div>

      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        className="eq-inp"
        placeholder={equipment.length ? 'Search equipment…' : 'Type name to add…'}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={openMenu}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />

      {/* Dropdown */}
      {open && (
        <div className="eq-menu" style={menuStyle}>
          {filtered.map(eq => (
            <div key={eq.id} className="eq-item">
              <label>
                <input type="checkbox"
                  checked={selectedIds.includes(eq.id)}
                  onMouseDown={e => e.preventDefault()}
                  onChange={() => toggle(eq.id)}
                />
                {' '}{eq.name}
              </label>
            </div>
          ))}
          {showCreate && (
            <div className="eq-cr"
              onMouseDown={e => e.preventDefault()}
              onClick={createNew}>
              Add as new: &ldquo;{query}&rdquo;
            </div>
          )}
          {!filtered.length && !showCreate && (
            <div style={{ padding: '6px 8px', color: '#aaa', fontSize: 12 }}>
              No equipment defined
            </div>
          )}
        </div>
      )}
    </div>
  );
}
