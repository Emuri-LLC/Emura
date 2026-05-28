'use client';

import { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import type { AppState, LaborRate, LibraryPart, LibraryEquipment, ReviewItem } from '@/lib/calculations';
import InfoIcon from '@/components/InfoIcon';
import QuoteReview from '@/components/QuoteReview';
import { uid } from '@/lib/state';

interface Props {
  state: AppState;
  onUpdate: (state: AppState) => void;
  resetKey?: number;
  libraryParts?: LibraryPart[];
  libraryEquipment?: LibraryEquipment[];
  onPushToLibrary?: (item: ReviewItem) => void;
}

export default function QuoteInfoTab({ state, onUpdate, resetKey = 0, libraryParts = [], libraryEquipment = [], onPushToLibrary }: Props) {
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.innerHTML = DOMPurify.sanitize(state.quote.notes ?? '', {
        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'em', 'strong', 'img'],
        ALLOWED_ATTR: ['src'],
        ALLOW_DATA_ATTR: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setQuote(field: keyof AppState['quote'], value: string) {
    onUpdate({ ...state, quote: { ...state.quote, [field]: value } });
  }

  function setSettings(field: keyof AppState['settings'], value: number) {
    onUpdate({ ...state, settings: { ...state.settings, [field]: value } });
  }

  function handleNotesPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = [...(e.clipboardData?.items ?? [])];
    const imgItem = items.find(i => i.type.startsWith('image/'));
    if (!imgItem) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = ev => {
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${ev.target?.result}" style="max-width:100%;display:block;margin:4px 0;">`
      );
      if (notesRef.current) setQuote('notes', notesRef.current.innerHTML);
    };
    reader.readAsDataURL(imgItem.getAsFile()!);
  }

  // ── Labor rate helpers ────────────────────────────────────────
  function setRate(idx: number, patch: Partial<LaborRate>) {
    const next = state.laborRates.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onUpdate({ ...state, laborRates: next });
  }

  function addRate() {
    const newRate: LaborRate = { id: uid(), name: '', rate: 0 };
    onUpdate({ ...state, laborRates: [...state.laborRates, newRate] });
  }

  function deleteRate(idx: number) {
    const rateId = state.laborRates[idx].id;
    const next = state.laborRates.filter((_, i) => i !== idx);
    // Clear rateId from any ops that referenced the deleted rate
    const directOps = state.directOps.map(op => op.rateId === rateId ? { ...op, rateId: '' } : op);
    const indirectOps = state.indirectOps.map(op => op.rateId === rateId ? { ...op, rateId: '' } : op);
    onUpdate({ ...state, laborRates: next, directOps, indirectOps });
  }

  return (
    <>
    <div className="grid2">

      {/* ── Quote Information ── */}
      <div className="card">
        <div className="card-hdr">Quote Information</div>
        <div className="card-body">

          <div className="fgrp">
            <label>Quote Name <InfoIcon k="qname" /></label>
            <input
              type="text"
              key={'name-' + resetKey}
              defaultValue={state.quote.name}
              onBlur={e => setQuote('name', e.target.value)}
            />
          </div>

          <div className="fgrp">
            <label>Customer <InfoIcon k="customer" /></label>
            <input
              type="text"
              key={'customer-' + resetKey}
              defaultValue={state.quote.customer}
              onBlur={e => setQuote('customer', e.target.value)}
            />
          </div>

          <div className="fgrp">
            <label>Date <InfoIcon k="date" /></label>
            <input
              type="date"
              value={state.quote.date}
              onChange={e => setQuote('date', e.target.value)}
            />
          </div>

          <div className="fgrp">
            <label>Revision Note <InfoIcon k="rev" /></label>
            <input
              type="text"
              placeholder="Brief note about this working draft…"
              value={state.quote.revision}
              onChange={e => setQuote('revision', e.target.value)}
            />
          </div>

          <div className="fgrp">
            <label>Notes <InfoIcon k="notes" /></label>
            <div
              ref={notesRef}
              contentEditable
              suppressContentEditableWarning
              className="notes-editable"
              onBlur={() => {
                if (notesRef.current) {
                  setQuote('notes', notesRef.current.innerHTML);
                }
              }}
              onPaste={handleNotesPaste}
            />
          </div>

        </div>
      </div>

      {/* ── Cost Settings ── */}
      <div className="card">
        <div className="card-hdr">Cost Settings</div>
        <div className="card-body">

          <div className="fgrp">
            <label>Working Hours / Year <InfoIcon k="wkHrs" /></label>
            <input
              type="number"
              key={'wkh-' + resetKey}
              defaultValue={state.settings.workingHoursPerYear}
              onBlur={e => setSettings('workingHoursPerYear', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="fgrp">
            <label>CapEx Depreciation Period (years) <InfoIcon k="capexYrs" /></label>
            <input
              type="number"
              key={'cy-' + resetKey}
              defaultValue={state.settings.capexYears}
              onBlur={e => setSettings('capexYears', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 12, color: '#1a2940' }}>
                Labor Rates ($/hr) <InfoIcon k="shopRate" />
              </label>
              <button className="btn btn-add btn-sm" onClick={addRate}>+ Add Rate</button>
            </div>
            {state.laborRates.length === 0 && (
              <div className="inline-warn">
                No labor rates defined. Operations will use $0/hr. Add at least one rate.
              </div>
            )}
            {state.laborRates.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                <input
                  type="text"
                  placeholder="Rate name (e.g. Shop Rate)"
                  key={r.id + '-name-' + resetKey}
                  defaultValue={r.name}
                  onBlur={e => setRate(i, { name: e.target.value })}
                  style={{ flex: 2 }}
                />
                <span style={{ color: '#888', fontSize: 12 }}>$</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  key={r.id + '-rate-' + resetKey}
                  defaultValue={r.rate || ''}
                  onBlur={e => setRate(i, { rate: parseFloat(e.target.value) || 0 })}
                  style={{ flex: 1, maxWidth: 80 }}
                />
                <span style={{ color: '#888', fontSize: 12 }}>/hr</span>
                <button className="btn btn-del btn-sm" onClick={() => deleteRate(i)}>✕</button>
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>

    {/* ── Quote Review ── */}
    <QuoteReview
      state={state}
      libraryParts={libraryParts}
      libraryEquipment={libraryEquipment}
      onUpdate={onUpdate}
      onPushToLibrary={onPushToLibrary ?? (() => {})}
    />

    </>
  );
}
