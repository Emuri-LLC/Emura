'use client';

import type { AppState, LibraryPart, LibraryEquipment, ReviewItem, QuoteWarning } from '@/lib/calculations';
import { computeQuoteReview, applyLibraryToQuote, computeQuoteWarnings } from '@/lib/calculations';
import SectionCard from '@/components/mcx/SectionCard';
import { Chip, Note } from '@/components/mcx/primitives';

interface Props {
  state: AppState;
  libraryParts: LibraryPart[];
  libraryEquipment: LibraryEquipment[];
  onUpdate: (state: AppState) => void;
  onPushToLibrary: (item: ReviewItem) => void;
  onReviewMaterials?: () => void;
}

// Warnings that point at the Material Costs tab — get a "Review" jump button.
const MATERIAL_WARNINGS: QuoteWarning['kind'][] = ['missing-cost', 'price-monotonicity'];

function fmt(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtValue(item: ReviewItem): [string, string] {
  if (item.kind === 'part')      return [fmt(item.quoteValue), fmt(item.libraryValue)];
  if (item.field === 'Run Rate') return [fmt(item.quoteValue) + '/hr', fmt(item.libraryValue) + '/hr'];
  return [fmt(item.quoteValue), fmt(item.libraryValue)];
}

const WARN_LABELS: Record<QuoteWarning['kind'], string> = {
  'missing-cost':       'Missing cost',
  'price-monotonicity': 'Price anomaly',
  'takt-exceeded':      'Takt exceeded',
  'util-over-100':      'Over-utilization',
};

function WarningRow({ w, onReview }: { w: QuoteWarning; onReview?: () => void }) {
  const blocking = w.kind === 'missing-cost';
  const canReview = onReview && MATERIAL_WARNINGS.includes(w.kind);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 12.5 }}>
      <span className={'mcx-sev ' + (blocking ? 'is-err' : 'is-warn')} />
      <Chip kind={blocking ? 'err' : 'warn'}>{WARN_LABELS[w.kind]}</Chip>
      <span style={{ color: 'var(--ink-2)' }}>{w.message}</span>
      {w.detail && <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 11 }}>{w.detail}</span>}
      {canReview && (
        <>
          <div className="mcx-spacer" />
          <button className="mcx-btn is-sm" onClick={onReview} title="Go to the Material Costs tab" style={{ flexShrink: 0 }}>Review →</button>
        </>
      )}
    </div>
  );
}

// A standard ⇄ tiered reconciliation row (replaces the per-break spam).
function StandardRow({ item, onApply, onPush }: { item: ReviewItem; onApply: () => void; onPush: () => void }) {
  const toQuote = item.standardAction === 'to-quote';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 12.5 }}>
      <span className="mcx-sev is-warn" />
      <Chip kind="warn">Standard ⇄ tiered</Chip>
      <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.itemName}</span>
      {item.locked && <Chip kind="neutral">🔒 shared</Chip>}
      <span style={{ color: 'var(--ink-3)' }}>
        {toQuote
          ? <>Library is a flat price {fmt(item.libraryValue)}; this quote is tiered.</>
          : <>Quoted standard {fmt(item.quoteValue)}; library still has volume tiers.</>}
      </span>
      <div className="mcx-spacer" />
      {toQuote
        ? <button className="mcx-btn is-sm" onClick={onApply} title="Make this quote item standard at the library price" style={{ flexShrink: 0 }}>← Make standard here</button>
        : <button className="mcx-btn is-sm" onClick={onPush} title="Replace the library's volume tiers with this flat price" style={{ flexShrink: 0 }}>→ Make library standard</button>}
    </div>
  );
}

function ReviewRow({ item, onApply, onPush }: { item: ReviewItem; onApply: () => void; onPush: () => void }) {
  const isRed    = item.direction === 'red';
  const [qv, lv] = fmtValue(item);
  const label = item.kind === 'part'
    ? (item.annualQty
        ? `${item.itemName} · ${item.breakLabel} (${item.annualQty.toLocaleString()}/yr)`
        : `${item.itemName} · standard`)
    : `${item.itemName} · ${item.field}`;
  const tip = isRed
    ? (item.kind === 'part' ? 'Library ≥ quote — may be undercosting' : 'Library higher — check rates')
    : (item.kind === 'part' ? 'Library lower — cost reduction available' : 'Library lower — consider updating');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 12.5 }}>
      <span className="mcx-sev" style={{ background: isRed ? 'var(--err)' : 'var(--ok)' }} />
      <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
      {item.locked && <Chip kind="neutral">🔒 shared</Chip>}
      <span style={{ color: 'var(--ink-3)' }}>Quote {qv} → Library {lv}</span>
      <span style={{ color: isRed ? 'var(--err)' : 'var(--ok-2)', fontSize: 11 }}>{tip}</span>
      <div className="mcx-spacer" />
      <button className="mcx-btn is-sm" onClick={onApply} title="Replace quote value with library value" style={{ flexShrink: 0 }}>← Use Library</button>
      {item.locked && (
        <button className="mcx-btn is-sm" onClick={onPush} title="Update library with this quote's current value" style={{ flexShrink: 0 }}>→ Update Library</button>
      )}
    </div>
  );
}

export default function QuoteReview({ state, libraryParts, libraryEquipment, onUpdate, onPushToLibrary, onReviewMaterials }: Props) {
  const noLibrary = libraryParts.length === 0 && libraryEquipment.length === 0;
  const warnings = computeQuoteWarnings(state);
  const items    = noLibrary ? [] : computeQuoteReview(state, libraryParts, libraryEquipment);
  const stdItems = items.filter(i => i.standardAction);
  const normal   = items.filter(i => !i.standardAction);
  const reds     = normal.filter(i => i.direction === 'red');
  const greens   = normal.filter(i => i.direction === 'green');
  const blocking = warnings.filter(w => w.kind === 'missing-cost').length;

  function applyOne(item: ReviewItem) { onUpdate(applyLibraryToQuote(state, [item])); }
  function applyAll() { onUpdate(applyLibraryToQuote(state, normal)); }

  const hasAnything = warnings.length > 0 || items.length > 0;

  return (
    <SectionCard
      icon="alert" iconColor={blocking ? 'var(--err)' : 'var(--ink-3)'}
      title="Quote Review"
      right={
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 6 }}>
          {blocking > 0 && <Chip kind="err">{blocking} blocking</Chip>}
          {reds.length > 0 && <Chip kind="err">{reds.length} underestimate{reds.length !== 1 ? 's' : ''}</Chip>}
          {greens.length > 0 && <Chip kind="ok">{greens.length} reduction{greens.length !== 1 ? 's' : ''}</Chip>}
          {stdItems.length > 0 && <Chip kind="warn">{stdItems.length} standard mismatch{stdItems.length !== 1 ? 'es' : ''}</Chip>}
        </span>
      }
      action={normal.length > 0 ? 'Update All from Library' : undefined}
      onAction={normal.length > 0 ? applyAll : undefined}
    >
      {!hasAnything && noLibrary && (
        <Note kind="accent">No library data yet. Save a quote with BOM items and material costs entered — parts appear in the library automatically.</Note>
      )}
      {!hasAnything && !noLibrary && (
        <Note kind="accent">✓ No warnings. All library prices match the quote.</Note>
      )}

      {warnings.length > 0 && (
        <div style={{ marginBottom: items.length ? 16 : 0 }}>
          <div className="mcx-eyebrow" style={{ marginBottom: 4 }}>Warnings</div>
          {warnings.map((w, i) => <WarningRow key={i} w={w} onReview={onReviewMaterials} />)}
        </div>
      )}

      {stdItems.length > 0 && (
        <div style={{ marginBottom: normal.length ? 16 : 0 }}>
          <div className="mcx-eyebrow" style={{ color: 'var(--warn)', marginBottom: 4 }}>Standard ⇄ tiered — reconcile flat vs volume pricing</div>
          {stdItems.map((item, i) => <StandardRow key={i} item={item} onApply={() => applyOne(item)} onPush={() => onPushToLibrary(item)} />)}
        </div>
      )}

      {normal.length > 0 && (
        <div>
          {reds.length > 0 && (
            <div style={{ marginBottom: greens.length ? 14 : 0 }}>
              <div className="mcx-eyebrow" style={{ color: 'var(--err)', marginBottom: 4 }}>Potential underestimates — library ≥ quote</div>
              {reds.map((item, i) => <ReviewRow key={i} item={item} onApply={() => applyOne(item)} onPush={() => onPushToLibrary(item)} />)}
            </div>
          )}
          {greens.length > 0 && (
            <div>
              <div className="mcx-eyebrow" style={{ color: 'var(--ok-2)', marginBottom: 4 }}>Cost reduction opportunities — library &lt; quote</div>
              {greens.map((item, i) => <ReviewRow key={i} item={item} onApply={() => applyOne(item)} onPush={() => onPushToLibrary(item)} />)}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
