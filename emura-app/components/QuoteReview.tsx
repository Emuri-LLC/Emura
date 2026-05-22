'use client';

import type { AppState, LibraryPart, LibraryEquipment, ReviewItem } from '@/lib/calculations';
import { computeQuoteReview, applyLibraryToQuote } from '@/lib/calculations';

interface Props {
  state: AppState;
  libraryParts: LibraryPart[];
  libraryEquipment: LibraryEquipment[];
  onUpdate: (state: AppState) => void;
}

function fmt(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtValue(item: ReviewItem): [string, string] {
  if (item.kind === 'part')         return [fmt(item.quoteValue),        fmt(item.libraryValue)];
  if (item.field === 'Run Rate')    return [fmt(item.quoteValue) + '/hr', fmt(item.libraryValue) + '/hr'];
  return [fmt(item.quoteValue), fmt(item.libraryValue)];
}

function ReviewRow({ item, onApply }: { item: ReviewItem; onApply: () => void }) {
  const isRed    = item.direction === 'red';
  const [qv, lv] = fmtValue(item);

  const label = item.kind === 'part'
    ? `${item.itemName}  ·  ${item.breakLabel} (${item.annualQty?.toLocaleString()}/yr)`
    : `${item.itemName}  ·  ${item.field}`;

  const tip = isRed
    ? (item.kind === 'part' ? 'Library ≥ quote — may be undercosting' : 'Library higher — check rates')
    : (item.kind === 'part' ? 'Library lower — cost reduction available' : 'Library lower — consider updating');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12,
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: isRed ? '#dc2626' : '#16a34a',
      }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: '#1a2940' }}>{label}</span>
        <span style={{ color: '#555', marginLeft: 8 }}>
          Quote {qv} → Library {lv}
        </span>
        <span style={{ color: isRed ? '#dc2626' : '#16a34a', marginLeft: 8, fontSize: 11 }}>
          {tip}
        </span>
      </div>
      <button
        className="btn btn-neu btn-sm"
        onClick={onApply}
        title="Replace quote value with library value"
        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        ← Use Library
      </button>
    </div>
  );
}

export default function QuoteReview({ state, libraryParts, libraryEquipment, onUpdate }: Props) {
  const noLibrary = libraryParts.length === 0 && libraryEquipment.length === 0;

  if (noLibrary) {
    return (
      <div className="card">
        <div className="card-hdr">Quote Review</div>
        <div className="card-body">
          <p className="empty-msg">
            No library data yet. Save a quote with BOM items and material costs entered — parts
            will appear in the library automatically.
          </p>
        </div>
      </div>
    );
  }

  const items  = computeQuoteReview(state, libraryParts, libraryEquipment);
  const reds   = items.filter(i => i.direction === 'red');
  const greens = items.filter(i => i.direction === 'green');

  function applyOne(item: ReviewItem) {
    onUpdate(applyLibraryToQuote(state, [item]));
  }

  function applyAll() {
    onUpdate(applyLibraryToQuote(state, items));
  }

  return (
    <div className="card">
      <div className="card-hdr">
        Quote Review
        {items.length > 0 && (
          <span style={{ fontWeight: 400, fontSize: 11.5, marginLeft: 10, color: '#555' }}>
            {reds.length > 0 && (
              <span style={{ color: '#dc2626', marginRight: 8 }}>
                ● {reds.length} potential underestimate{reds.length !== 1 ? 's' : ''}
              </span>
            )}
            {greens.length > 0 && (
              <span style={{ color: '#16a34a' }}>
                ● {greens.length} cost reduction{greens.length !== 1 ? 's' : ''} available
              </span>
            )}
          </span>
        )}
        {items.length > 0 && (
          <button
            className="btn btn-neu btn-sm"
            onClick={applyAll}
            title="Replace all quote values with library values"
            style={{ marginLeft: 'auto' }}
          >
            ← Update All from Library
          </button>
        )}
      </div>
      <div className="card-body">
        {items.length === 0 ? (
          <p style={{ fontSize: 12, color: '#555' }}>✓ All library prices match the quote.</p>
        ) : (
          <div>
            {reds.length > 0 && (
              <div style={{ marginBottom: greens.length ? 14 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Potential underestimates — library ≥ quote
                </div>
                {reds.map((item, i) => <ReviewRow key={i} item={item} onApply={() => applyOne(item)} />)}
              </div>
            )}
            {greens.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Cost reduction opportunities — library &lt; quote
                </div>
                {greens.map((item, i) => <ReviewRow key={i} item={item} onApply={() => applyOne(item)} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
