'use client';

import type { AppState, LibraryPart, LibraryEquipment, ReviewItem, QuoteWarning } from '@/lib/calculations';
import { computeQuoteReview, applyLibraryToQuote, computeQuoteWarnings } from '@/lib/calculations';

interface Props {
  state: AppState;
  libraryParts: LibraryPart[];
  libraryEquipment: LibraryEquipment[];
  onUpdate: (state: AppState) => void;
  onPushToLibrary: (item: ReviewItem) => void;
}

function fmt(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtValue(item: ReviewItem): [string, string] {
  if (item.kind === 'part')         return [fmt(item.quoteValue),        fmt(item.libraryValue)];
  if (item.field === 'Run Rate')    return [fmt(item.quoteValue) + '/hr', fmt(item.libraryValue) + '/hr'];
  return [fmt(item.quoteValue), fmt(item.libraryValue)];
}

const WARN_LABELS: Record<QuoteWarning['kind'], string> = {
  'missing-cost':       'Missing cost',
  'price-monotonicity': 'Price anomaly',
  'takt-exceeded':      'Takt exceeded',
  'util-over-100':      'Over-utilization',
};

function WarningRow({ w }: { w: QuoteWarning }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12,
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3,
        background: '#f59e0b',
      }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: '#92400e', marginRight: 6 }}>
          {WARN_LABELS[w.kind]}
        </span>
        <span style={{ color: '#555' }}>{w.message}</span>
        {w.detail && (
          <span style={{ color: '#888', marginLeft: 8, fontSize: 11 }}>{w.detail}</span>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ item, onApply, onPush }: { item: ReviewItem; onApply: () => void; onPush: () => void }) {
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
        {item.locked && (
          <span style={{ color: '#888', marginLeft: 6, fontSize: 10, fontStyle: 'italic' }}>🔒 shared</span>
        )}
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
      {item.locked && (
        <button
          className="btn btn-neu btn-sm"
          onClick={onPush}
          title="Update library with this quote's current value"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          → Update Library
        </button>
      )}
    </div>
  );
}

export default function QuoteReview({ state, libraryParts, libraryEquipment, onUpdate, onPushToLibrary }: Props) {
  const noLibrary = libraryParts.length === 0 && libraryEquipment.length === 0;

  const warnings = computeQuoteWarnings(state);
  const items    = noLibrary ? [] : computeQuoteReview(state, libraryParts, libraryEquipment);
  const reds     = items.filter(i => i.direction === 'red');
  const greens   = items.filter(i => i.direction === 'green');

  function applyOne(item: ReviewItem) {
    onUpdate(applyLibraryToQuote(state, [item]));
  }

  function applyAll() {
    onUpdate(applyLibraryToQuote(state, items));
  }

  const hasAnything = warnings.length > 0 || items.length > 0;

  return (
    <div className="card">
      <div className="card-hdr">
        Quote Review
        <span style={{ fontWeight: 400, fontSize: 11.5, marginLeft: 10, color: '#555' }}>
          {warnings.length > 0 && (
            <span style={{ color: '#b45309', marginRight: 8 }}>
              ● {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
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
        {!hasAnything && noLibrary && (
          <p className="empty-msg">
            No library data yet. Save a quote with BOM items and material costs entered — parts
            will appear in the library automatically.
          </p>
        )}
        {!hasAnything && !noLibrary && (
          <p style={{ fontSize: 12, color: '#555' }}>✓ No warnings. All library prices match the quote.</p>
        )}

        {warnings.length > 0 && (
          <div style={{ marginBottom: items.length ? 16 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Warnings
            </div>
            {warnings.map((w, i) => <WarningRow key={i} w={w} />)}
          </div>
        )}

        {items.length > 0 && (
          <div>
            {reds.length > 0 && (
              <div style={{ marginBottom: greens.length ? 14 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Potential underestimates — library ≥ quote
                </div>
                {reds.map((item, i) => <ReviewRow key={i} item={item} onApply={() => applyOne(item)} onPush={() => onPushToLibrary(item)} />)}
              </div>
            )}
            {greens.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Cost reduction opportunities — library &lt; quote
                </div>
                {greens.map((item, i) => <ReviewRow key={i} item={item} onApply={() => applyOne(item)} onPush={() => onPushToLibrary(item)} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
