'use client';

import type { AppState, LibraryPart, LibraryEquipment, ReviewItem } from '@/lib/calculations';
import { computeQuoteReview } from '@/lib/calculations';

interface Props {
  state: AppState;
  libraryParts: LibraryPart[];
  libraryEquipment: LibraryEquipment[];
}

function fmt(n: number, isCurrency = true) {
  if (isCurrency) return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString();
}

function fmtValue(item: ReviewItem) {
  // CapEx and Maintenance are dollar totals; Run Rate is $/hr; parts are $/unit
  if (item.kind === 'part') return [fmt(item.quoteValue), fmt(item.libraryValue)];
  if (item.field === 'Run Rate') return [fmt(item.quoteValue) + '/hr', fmt(item.libraryValue) + '/hr'];
  return [fmt(item.quoteValue), fmt(item.libraryValue)];
}

function ReviewRow({ item }: { item: ReviewItem }) {
  const isRed = item.direction === 'red';
  const [qv, lv] = fmtValue(item);

  const dot = (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: isRed ? '#dc2626' : '#16a34a',
      marginRight: 7, flexShrink: 0,
    }} />
  );

  let label: string;
  let detail: string;
  if (item.kind === 'part') {
    label = `${item.itemName}  ·  ${item.breakLabel} (${item.annualQty?.toLocaleString()}/yr)`;
    detail = `Quote ${qv}  →  Library ${lv}`;
  } else {
    label = `${item.itemName}  ·  ${item.field}`;
    detail = `Quote ${qv}  →  Library ${lv}`;
  }

  const tip = isRed
    ? (item.kind === 'part'
        ? 'Library price ≥ quote — real cost may be higher than estimated'
        : 'Library value is higher than quoted — check for updated rates')
    : (item.kind === 'part'
        ? 'Library price is lower — potential cost reduction opportunity'
        : 'Library value is lower — consider updating the quote');

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 4,
      padding: '5px 0', borderBottom: '1px solid #f0f0f0',
      fontSize: 12,
    }}>
      <span style={{ paddingTop: 3 }}>{dot}</span>
      <div>
        <span style={{ fontWeight: 600, color: '#1a2940' }}>{label}</span>
        <span style={{ color: '#555', marginLeft: 8 }}>{detail}</span>
        <span style={{ color: isRed ? '#dc2626' : '#16a34a', marginLeft: 8, fontSize: 11 }}>{tip}</span>
      </div>
    </div>
  );
}

export default function QuoteReview({ state, libraryParts, libraryEquipment }: Props) {
  const noLibrary = libraryParts.length === 0 && libraryEquipment.length === 0;

  if (noLibrary) {
    return (
      <div className="card">
        <div className="card-hdr">Quote Review</div>
        <div className="card-body">
          <p className="empty-msg">
            No library data available. Add parts and equipment to the org library to enable price comparison.
          </p>
        </div>
      </div>
    );
  }

  const items = computeQuoteReview(state, libraryParts, libraryEquipment);
  const reds   = items.filter(i => i.direction === 'red');
  const greens = items.filter(i => i.direction === 'green');

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
      </div>
      <div className="card-body">
        {items.length === 0 ? (
          <p style={{ fontSize: 12, color: '#555' }}>
            ✓ All library prices match the quote.
          </p>
        ) : (
          <div>
            {reds.length > 0 && (
              <div style={{ marginBottom: greens.length ? 14 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Potential underestimates — library price ≥ quote
                </div>
                {reds.map((item, i) => <ReviewRow key={i} item={item} />)}
              </div>
            )}
            {greens.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Cost reduction opportunities — library price &lt; quote
                </div>
                {greens.map((item, i) => <ReviewRow key={i} item={item} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
