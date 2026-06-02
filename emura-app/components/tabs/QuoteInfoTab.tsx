'use client';

import { useRef, useEffect } from 'react';
import type { AppState, LaborRate, LibraryPart, LibraryEquipment, ReviewItem } from '@/lib/calculations';
import { TIPS } from '@/components/InfoIcon';
import QuoteReview from '@/components/QuoteReview';
import CostDrivers from '@/components/CostDrivers';
import SectionCard from '@/components/mcx/SectionCard';
import NumX from '@/components/mcx/NumX';
import Icon from '@/components/mcx/Icon';
import { Note, HelpI } from '@/components/mcx/primitives';
import { uid } from '@/lib/state';
import { sanitizeNotes } from '@/lib/sanitize';

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

  // Re-runs on resetKey change (import / undo / redo / new) so the contenteditable
  // picks up freshly-loaded notes. Deliberately NOT keyed on state.quote.notes.
  useEffect(() => {
    if (notesRef.current) notesRef.current.innerHTML = sanitizeNotes(state.quote.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

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
      document.execCommand('insertHTML', false, `<img src="${ev.target?.result}" style="max-width:100%;display:block;margin:4px 0;">`);
      if (notesRef.current) setQuote('notes', sanitizeNotes(notesRef.current.innerHTML));
    };
    reader.readAsDataURL(imgItem.getAsFile()!);
  }

  function handleNotesKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const cmds: Record<string, string> = { b: 'bold', i: 'italic', u: 'underline' };
    const cmd = cmds[e.key.toLowerCase()];
    if (!cmd) return;
    e.preventDefault();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd);
  }

  function setRate(idx: number, patch: Partial<LaborRate>) {
    const next = state.laborRates.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onUpdate({ ...state, laborRates: next });
  }
  function addRate() {
    onUpdate({ ...state, laborRates: [...state.laborRates, { id: uid(), name: '', rate: 0 }] });
  }
  function deleteRate(idx: number) {
    const rateId = state.laborRates[idx].id;
    const next = state.laborRates.filter((_, i) => i !== idx);
    const directOps = state.directOps.map(op => op.rateId === rateId ? { ...op, rateId: '' } : op);
    const indirectOps = state.indirectOps.map(op => op.rateId === rateId ? { ...op, rateId: '' } : op);
    onUpdate({ ...state, laborRates: next, directOps, indirectOps });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '452px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>

      {/* ── LEFT RAIL ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionCard icon="doc" title="Quote Information">
          <div className="mcx-field">
            <span className="mcx-label">Quote Name <HelpI tip={TIPS.qname} /></span>
            <input className="mcx-input" key={'name-' + resetKey} defaultValue={state.quote.name} onBlur={e => setQuote('name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="mcx-field">
              <span className="mcx-label">Customer <HelpI tip={TIPS.customer} /></span>
              <input className="mcx-input" key={'customer-' + resetKey} defaultValue={state.quote.customer} onBlur={e => setQuote('customer', e.target.value)} />
            </div>
            <div className="mcx-field">
              <span className="mcx-label">Date <HelpI tip={TIPS.date} /></span>
              <input className="mcx-input" type="date" value={state.quote.date} onChange={e => setQuote('date', e.target.value)} />
            </div>
          </div>
          <div className="mcx-field">
            <span className="mcx-label">Revision Note <HelpI tip={TIPS.rev} /></span>
            <input className="mcx-input" placeholder="Brief note about this working draft…" value={state.quote.revision} onChange={e => setQuote('revision', e.target.value)} />
          </div>
          <div className="mcx-field">
            <span className="mcx-label">Notes <HelpI tip={TIPS.notes} /></span>
            <div
              ref={notesRef}
              contentEditable
              suppressContentEditableWarning
              className="mcx-notes"
              data-placeholder="Free-text notes. Paste an image to embed it."
              onBlur={() => { if (notesRef.current) setQuote('notes', sanitizeNotes(notesRef.current.innerHTML)); }}
              onKeyDown={handleNotesKeyDown}
              onPaste={handleNotesPaste}
            />
          </div>
        </SectionCard>

        <SectionCard icon="gear" title="Cost Settings">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="mcx-field">
              <span className="mcx-label">Hours / Year <HelpI tip={TIPS.wkHrs} /></span>
              <NumX value={state.settings.workingHoursPerYear} min={0} key={'wkh-' + resetKey} onCommit={v => setSettings('workingHoursPerYear', v)} />
            </div>
            <div className="mcx-field">
              <span className="mcx-label">CapEx (yrs) <HelpI tip={TIPS.capexYrs} /></span>
              <NumX value={state.settings.capexYears} min={0} key={'cy-' + resetKey} onCommit={v => setSettings('capexYears', v)} />
            </div>
          </div>

          <div className="mcx-field" style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mcx-label">Labor Rates <HelpI tip={TIPS.shopRate} /></span>
              <button className="mcx-btn is-sm is-quiet" style={{ color: 'var(--accent-ink)' }} onClick={addRate}><Icon name="plus" size={12} />Add Rate</button>
            </div>
            {state.laborRates.length === 0 && (
              <Note kind="warn" style={{ marginTop: 2 }}>No labor rates defined. Operations will use $0/hr. Add at least one rate.</Note>
            )}
            {state.laborRates.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 2 }}>
                {state.laborRates.map((r, i) => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 28px', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
                    <input className="mcx-input" style={{ height: 28 }} placeholder="Rate name" key={r.id + '-name-' + resetKey} defaultValue={r.name} onBlur={e => setRate(i, { name: e.target.value })} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <NumX value={r.rate || 0} min={0} blankZero suffix="$" width={92} key={r.id + '-rate-' + resetKey} onCommit={v => setRate(i, { rate: v })} />
                      <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>/hr</span>
                    </div>
                    <button className="mcx-btn is-sm is-quiet is-icon" style={{ color: 'var(--err)' }} onClick={() => deleteRate(i)}><Icon name="x" size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <Note kind="accent">Every keystroke recalculates the full quote. No <b>Calculate</b> button — the figure in the ribbon is always live.</Note>
      </div>

      {/* ── RIGHT WORKING AREA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <QuoteReview
          state={state}
          libraryParts={libraryParts}
          libraryEquipment={libraryEquipment}
          onUpdate={onUpdate}
          onPushToLibrary={onPushToLibrary ?? (() => {})}
        />
        <CostDrivers state={state} />
      </div>
    </div>
  );
}
