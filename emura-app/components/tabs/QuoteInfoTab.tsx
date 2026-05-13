'use client';

import { useRef, useEffect } from 'react';
import type { AppState } from '@/lib/calculations';
import InfoIcon from '@/components/InfoIcon';

interface Props {
  state: AppState;
  onUpdate: (state: AppState) => void;
}

export default function QuoteInfoTab({ state, onUpdate }: Props) {
  const notesRef = useRef<HTMLDivElement>(null);

  // Set the contenteditable notes HTML once on mount.
  // We don't update it on every render — that would reset the cursor.
  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.innerHTML = state.quote.notes ?? '';
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

  return (
    <div className="grid2">

      {/* ── Quote Information ── */}
      <div className="card">
        <div className="card-hdr">Quote Information</div>
        <div className="card-body">

          <div className="fgrp">
            <label>Quote Name <InfoIcon k="qname" /></label>
            <input
              type="text"
              value={state.quote.name}
              onChange={e => setQuote('name', e.target.value)}
            />
          </div>

          <div className="fgrp">
            <label>Customer <InfoIcon k="customer" /></label>
            <input
              type="text"
              value={state.quote.customer}
              onChange={e => setQuote('customer', e.target.value)}
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
            <label>Revision <InfoIcon k="rev" /></label>
            <input
              type="text"
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
              onInput={() => {
                if (notesRef.current) {
                  setQuote('notes', notesRef.current.innerHTML);
                }
              }}
              onPaste={handleNotesPaste}
            />
          </div>

        </div>
      </div>

      {/* ── Cost Rate Settings ── */}
      <div className="card">
        <div className="card-hdr">Cost Rate Settings</div>
        <div className="card-body">

          <div className="fgrp">
            <label>Shop Rate ($/hr) — Direct Labor <InfoIcon k="shopRate" /></label>
            <input
              type="number"
              value={state.settings.shopRate}
              onChange={e => setSettings('shopRate', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="fgrp">
            <label>Indirect Rate ($/hr) — Overhead Labor <InfoIcon k="indRate" /></label>
            <input
              type="number"
              value={state.settings.indirectRate}
              onChange={e => setSettings('indirectRate', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="fgrp">
            <label>Working Hours / Year <InfoIcon k="wkHrs" /></label>
            <input
              type="number"
              value={state.settings.workingHoursPerYear}
              onChange={e => setSettings('workingHoursPerYear', parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="fgrp">
            <label>CapEx Depreciation Period (years) <InfoIcon k="capexYrs" /></label>
            <input
              type="number"
              value={state.settings.capexYears}
              onChange={e => setSettings('capexYears', parseFloat(e.target.value) || 0)}
            />
          </div>

        </div>
      </div>

    </div>
  );
}
