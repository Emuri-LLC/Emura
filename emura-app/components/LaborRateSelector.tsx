'use client';

import { useState, useRef } from 'react';
import type { LaborRate, LibraryLaborRate } from '@/lib/calculations';

interface Props {
  selectedId: string;
  rates: LaborRate[];           // rates defined in this quote
  libraryRates: LibraryLaborRate[]; // rates from the org library
  onChange: (rateId: string) => void;
  onCreateRate: (name: string, rate: number) => string; // returns new rate id
  onCopyFromLibrary: (libRate: LibraryLaborRate) => void; // copies to quote and selects, no return needed
}

export default function LaborRateSelector({
  selectedId, rates, libraryRates, onChange, onCreateRate, onCopyFromLibrary,
}: Props) {
  const [query, setQuery]     = useState('');
  const [open, setOpen]       = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = rates.find(r => r.id === selectedId);

  function openMenu() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setMenuStyle({ position: 'fixed', top: r.bottom + 2, left: r.left,
      width: Math.max(220, r.width), zIndex: 9999 });
    setOpen(true);
  }

  function pick(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
  }

  function createNew() {
    const name = query.trim();
    if (!name) return;
    const id = onCreateRate(name, 0);
    onChange(id);
    setQuery('');
    setOpen(false);
  }

  const q = query.toLowerCase();
  const filteredQuote   = rates.filter(r => !q || r.name.toLowerCase().includes(q));
  const filteredLib     = libraryRates.filter(lr =>
    !q || lr.name.toLowerCase().includes(q)
  );
  // Don't show library entries already present in the quote by name
  const quoteNames = new Set(rates.map(r => r.name.trim().toLowerCase()));
  const newFromLib  = filteredLib.filter(lr => !quoteNames.has(lr.name.trim().toLowerCase()));

  const exactMatch = rates.some(r => r.name.toLowerCase() === q) ||
    libraryRates.some(lr => lr.name.toLowerCase() === q);
  const showCreate = query.length > 0 && !exactMatch;

  return (
    <div className="eq-dd">
      <input
        ref={inputRef}
        type="text"
        className="eq-inp"
        placeholder={selected ? selected.name : rates.length ? 'Select rate…' : 'Add rate…'}
        value={open ? query : (selected ? `${selected.name} ($${selected.rate}/hr)` : '')}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setQuery(''); openMenu(); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        autoComplete="off"
      />

      {open && (
        <div className="eq-menu" style={menuStyle}>
          {/* Clear selection */}
          {selectedId && (
            <div className="eq-item">
              <label onMouseDown={e => e.preventDefault()} onClick={() => pick('')}>
                <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>— Use default rate —</span>
              </label>
            </div>
          )}

          {/* From this quote */}
          {filteredQuote.length > 0 && (
            <>
              <div className="eq-sec">From this quote</div>
              {filteredQuote.map(r => (
                <div key={r.id} className="eq-item">
                  <label onMouseDown={e => e.preventDefault()} onClick={() => pick(r.id)}>
                    <input type="radio" readOnly checked={selectedId === r.id} style={{ width: 'auto' }} />
                    {' '}{r.name} <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>— ${r.rate}/hr</span>
                  </label>
                </div>
              ))}
            </>
          )}

          {/* From library */}
          {newFromLib.length > 0 && (
            <>
              <div className="eq-sec" style={{ borderTop: '1px solid var(--hairline)' }}>From library</div>
              {newFromLib.map(lr => (
                <div key={lr.id} className="eq-item">
                  <label
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onCopyFromLibrary(lr);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    {lr.name} <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>— ${lr.rate}/hr</span>
                    {lr.locked && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--warn)' }}>locked</span>}
                    <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ok-2)' }}>← copy</span>
                  </label>
                </div>
              ))}
            </>
          )}

          {/* Create new */}
          {showCreate && (
            <div className="eq-cr"
              onMouseDown={e => e.preventDefault()}
              onClick={createNew}>
              Add as new: &ldquo;{query}&rdquo;
            </div>
          )}

          {filteredQuote.length === 0 && newFromLib.length === 0 && !showCreate && (
            <div style={{ padding: '6px 8px', color: 'var(--ink-4)', fontSize: 12 }}>
              No rates — type to create
            </div>
          )}
        </div>
      )}
    </div>
  );
}
