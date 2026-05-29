'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { QuoteSummary, QuoteRevision } from '@/lib/db';
import type { QuoteStatusEntry } from '@/lib/quoteStatus';
import { fmtC } from '@/lib/format';

interface Props {
  quotes:   QuoteSummary[];
  userId:   string;
  role:     string;
  emailMap: Record<string, string>;
  onOpen:   (id: string, revisionId?: string) => void;
  onNew:    () => void;
  onDelete: (id: string) => void;
  statusCache?:         Record<string, QuoteStatusEntry | 'loading'>;
  onVisibleIdsChange?:  (ids: string[]) => void;
  contentMatchIds?:     string[] | null;   // ids from a server content search, or null when inactive
  contentSearching?:    boolean;
  onContentSearch?:     (term: string) => void;
}

type SortKey = 'quoteNumber' | 'name' | 'customer' | 'updatedAt';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtQuoteNum(n: number) {
  if (!n) return '—';
  return 'Q-' + String(n).padStart(3, '0');
}

function resolveEmail(emailMap: Record<string, string>, id: string): string {
  if (!id) return '—';
  return emailMap[id] ?? id.slice(0, 8) + '…';
}

function sortIndicator(col: SortKey, sortKey: SortKey, sortAsc: boolean) {
  if (sortKey !== col) return <span style={{ opacity: 0.3, marginLeft: 3, fontSize: 10 }}>↕</span>;
  return <span style={{ marginLeft: 3, fontSize: 10 }}>{sortAsc ? '↑' : '↓'}</span>;
}

const thBase: React.CSSProperties = {
  padding: '8px 12px', fontWeight: 600, cursor: 'pointer',
  userSelect: 'none', whiteSpace: 'nowrap',
};

// ── Status tooltip (defined outside to avoid inner-component anti-pattern) ──

function StatusTooltip({ entry, pos, onMouseEnter, onMouseLeave }: {
  entry: QuoteStatusEntry | 'loading';
  pos: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  if (entry === 'loading') {
    return (
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'fixed', top: pos.top, left: pos.left,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          padding: '8px 12px', zIndex: 9999, fontSize: 12, color: '#888',
        }}
      >
        Computing…
      </div>
    );
  }

  const WARN_COLOR = '#f59e0b';
  const RED_COLOR  = '#dc2626';
  const GREEN_COLOR = '#16a34a';

  const lines: { color: string; text: string }[] = [];

  if (entry.redCount > 0) {
    lines.push({ color: RED_COLOR, text: `${entry.redCount} library price${entry.redCount !== 1 ? 's' : ''} ≥ quote — possible underestimate` });
  }
  entry.warnings.forEach(w => {
    lines.push({ color: WARN_COLOR, text: w.detail ? `${w.message} (${w.detail})` : w.message });
  });
  if (entry.greenCount > 0) {
    lines.push({ color: GREEN_COLOR, text: `${entry.greenCount} cost reduction${entry.greenCount !== 1 ? 's' : ''} available from library` });
  }

  const MAX = 8;
  const overflow = lines.length > MAX;
  const shown = lines.slice(0, MAX);

  if (!shown.length) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed', top: pos.top, left: pos.left,
        background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,.12)',
        padding: '8px 12px', minWidth: 240, maxWidth: 380,
        zIndex: 9999, fontSize: 12,
      }}
    >
      {shown.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: i < shown.length - 1 ? 4 : 0 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: l.color, marginTop: 3, flexShrink: 0 }} />
          <span style={{ color: '#374151', lineHeight: 1.4 }}>{l.text}</span>
        </div>
      ))}
      {overflow && <div style={{ color: '#9ca3af', marginTop: 4, fontSize: 11 }}>…and {lines.length - MAX} more</div>}
    </div>
  );
}

// ── Revision row ─────────────────────────────────────────────────────────────

function RevRow({ label, bold, revNote, date, displayName, onClick }: {
  label: string; bold?: boolean; revNote?: string; date: string; displayName: string; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
        cursor: 'pointer', borderRadius: 4,
        background: hover ? '#e8f0fe' : 'transparent',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <span style={{ fontWeight: bold ? 600 : 500, color: bold ? '#2563eb' : '#1a2940', minWidth: 96, fontSize: 12 }}>{label}</span>
      {revNote && <span style={{ color: '#374151', fontSize: 12, fontStyle: 'italic' }}>{revNote}</span>}
      <span style={{ color: '#aaa', fontSize: 11 }}>—</span>
      <span style={{ color: '#555', fontSize: 12 }}>{fmtDate(date)}</span>
      <span style={{ color: '#aaa', fontSize: 11 }}>—</span>
      <span style={{ color: '#888', fontSize: 12 }}>{displayName}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuotesList({
  quotes, userId, role, emailMap, onOpen, onNew, onDelete,
  statusCache = {}, onVisibleIdsChange,
  contentMatchIds = null, contentSearching = false, onContentSearch,
}: Props) {
  const canEdit = role === 'admin' || role === 'estimator';
  const [search,   setSearch]   = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('updatedAt');
  const [sortAsc,  setSortAsc]  = useState(false);
  const [openRevs, setOpenRevs] = useState<string | null>(null);

  // Advanced content search (separate from the name/customer quick filter)
  const [advTerm,       setAdvTerm]       = useState('');
  const [submittedTerm, setSubmittedTerm] = useState('');

  // Tooltip state
  const [hoveredDotId, setHoveredDotId] = useState<string | null>(null);
  const [tooltipPos,   setTooltipPos]   = useState({ top: 0, left: 0 });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always call the latest version of onVisibleIdsChange from the debounce
  const visibleCbRef = useRef(onVisibleIdsChange);
  useEffect(() => { visibleCbRef.current = onVisibleIdsChange; });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key === 'quoteNumber'); }
  }

  const sortQuotes = (list: QuoteSummary[]) => [...list].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'quoteNumber': cmp = (a.quoteNumber ?? 0) - (b.quoteNumber ?? 0); break;
      case 'name':        cmp = (a.name || '').localeCompare(b.name || ''); break;
      case 'customer':    cmp = (a.customer || '').localeCompare(b.customer || ''); break;
      case 'updatedAt':   cmp = (a.updatedAt || '').localeCompare(b.updatedAt || ''); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  // When a content search is active, results are two-tiered: name/customer
  // matches first, then content-only matches (badged). Otherwise the quick
  // filter (name/customer/number) applies as before.
  const advActive = contentMatchIds != null && submittedTerm.trim() !== '';
  const contentOnlyIds = new Set<string>();
  let displayList: QuoteSummary[];
  if (advActive) {
    const term = submittedTerm.toLowerCase();
    const matchesMeta = (q: QuoteSummary) =>
      q.name.toLowerCase().includes(term) ||
      q.customer.toLowerCase().includes(term) ||
      fmtQuoteNum(q.quoteNumber).toLowerCase().includes(term);
    const idSet = new Set(contentMatchIds);
    const tier1 = sortQuotes(quotes.filter(matchesMeta));
    const tier1Ids = new Set(tier1.map(q => q.id));
    const tier2 = sortQuotes(quotes.filter(q => idSet.has(q.id) && !tier1Ids.has(q.id)));
    tier2.forEach(q => contentOnlyIds.add(q.id));
    displayList = [...tier1, ...tier2];
  } else {
    const sq = search.toLowerCase();
    const filtered = search
      ? quotes.filter(q =>
          q.name.toLowerCase().includes(sq) ||
          q.customer.toLowerCase().includes(sq) ||
          fmtQuoteNum(q.quoteNumber).toLowerCase().includes(sq)
        )
      : quotes;
    displayList = sortQuotes(filtered);
  }

  function submitContentSearch() {
    setSubmittedTerm(advTerm);
    onContentSearch?.(advTerm);
  }
  function clearContentSearch() {
    setAdvTerm('');
    setSubmittedTerm('');
    onContentSearch?.('');
  }

  // Report visible IDs after a 350ms debounce — fires when the list stabilizes
  const visibleKey = displayList.map(q => q.id).join(',');
  useEffect(() => {
    const ids = displayList.map(q => q.id);
    const t = setTimeout(() => visibleCbRef.current?.(ids), 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  // Tooltip show/hide helpers
  function showDot(id: string, e: React.MouseEvent) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({ top: r.bottom + 4, left: r.left });
    setHoveredDotId(id);
  }
  function startHide() {
    hideTimerRef.current = setTimeout(() => setHoveredDotId(null), 120);
  }
  function cancelHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }

  return (
    <div className="card" style={{ maxWidth: 960, margin: '32px auto' }}>
      <div className="card-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>My Quotes</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filter name / customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: 170 }}
          />
          <input
            type="text"
            placeholder="Search within quotes…"
            value={advTerm}
            onChange={e => setAdvTerm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitContentSearch(); }}
            title="Search part numbers, equipment, labor rates, and notes across all quotes"
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: 190 }}
          />
          <button className="btn btn-neu btn-sm" onClick={submitContentSearch} disabled={contentSearching}>
            {contentSearching ? '…' : 'Search'}
          </button>
          {advActive && (
            <button className="btn btn-neu btn-sm" onClick={clearContentSearch}>Clear</button>
          )}
          {canEdit && (
            <button className="btn btn-add btn-sm" onClick={onNew}>+ New Quote</button>
          )}
        </div>
      </div>

      <div className="card-body" style={{ padding: 0 }}>
        {displayList.length === 0 ? (
          <p className="empty-msg" style={{ padding: '24px 16px' }}>
            {quotes.length === 0
              ? (canEdit ? 'No quotes yet. Click + New Quote to get started.' : 'No quotes yet.')
              : advActive ? `No quotes match "${submittedTerm}".`
              : 'No quotes match your search.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ ...thBase, width: 24, cursor: 'default', padding: '8px 4px 8px 12px' }} />
                <th style={{ ...thBase, textAlign: 'left',  width: 78   }} onClick={() => handleSort('quoteNumber')}>#&nbsp;{sortIndicator('quoteNumber', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'left'               }} onClick={() => handleSort('name')}>Quote Name&nbsp;{sortIndicator('name', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'left'               }} onClick={() => handleSort('customer')}>Customer&nbsp;{sortIndicator('customer', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'right', cursor: 'default' }} title="Cost $/unit at the quote's primary FG + break (set on the Finished Goods tab)">Est. $/unit</th>
                <th style={{ ...thBase, textAlign: 'right'              }} onClick={() => handleSort('updatedAt')}>Last Updated&nbsp;{sortIndicator('updatedAt', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'right', cursor: 'default' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(q => {
                const maxRev    = q.revisions[0]?.revNumber ?? 0;
                const isRevOpen = openRevs === q.id;
                const statusEntry = statusCache[q.id];
                const contentOnly = contentOnlyIds.has(q.id);

                // Dot color
                let dotClass = '';
                let dotColor = '';
                if (statusEntry === 'loading') {
                  dotClass = 'qdot qdot-loading';
                } else if (statusEntry) {
                  if (statusEntry.redCount > 0) dotColor = '#dc2626';
                  else if (statusEntry.warnCount > 0) dotColor = '#f59e0b';
                  else if (statusEntry.greenCount > 0) dotColor = '#16a34a';
                }

                const showDot = !!(statusEntry && (statusEntry === 'loading' || statusEntry.redCount > 0 || statusEntry.warnCount > 0 || statusEntry.greenCount > 0));

                return (
                  <React.Fragment key={q.id}>
                    <tr style={{ borderBottom: isRevOpen ? 'none' : '1px solid #f0f2f5' }}>
                      <td style={{ padding: '8px 4px 8px 12px', width: 24 }}>
                        {showDot && (
                          <span
                            className={dotClass || 'qdot'}
                            style={dotColor ? { background: dotColor } : undefined}
                            onMouseEnter={e => { if (statusEntry && statusEntry !== 'loading') { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); setTooltipPos({ top: r.bottom + 4, left: r.left }); setHoveredDotId(q.id); } else if (statusEntry === 'loading') { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); setTooltipPos({ top: r.bottom + 4, left: r.left }); setHoveredDotId(q.id); } }}
                            onMouseLeave={startHide}
                          />
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#888', fontFamily: 'monospace', fontSize: 12 }}>
                        {fmtQuoteNum(q.quoteNumber)}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                        {q.name || '—'}
                        {contentOnly && (
                          <span title="Matched inside the quote contents" style={{ marginLeft: 6, fontSize: 10, color: '#0369a1', background: '#e0f2fe', borderRadius: 3, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                            in contents
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#555' }}>{q.customer || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#555', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {statusEntry && statusEntry !== 'loading' && statusEntry.primaryTotal != null ? fmtC(statusEntry.primaryTotal, 2) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {fmtDate(q.updatedAt)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-neu btn-sm"
                          onClick={() => { setOpenRevs(null); onOpen(q.id); }}
                          style={{ marginRight: 4 }}>Open</button>
                        {maxRev > 0 && (
                          <button
                            className="btn btn-neu btn-sm"
                            onClick={() => setOpenRevs(v => v === q.id ? null : q.id)}
                            style={{ marginRight: 4 }}
                          >
                            Rev {maxRev}&nbsp;▾
                          </button>
                        )}
                        {(role === 'admin' || q.createdBy === userId) && (
                          <button className="btn btn-del btn-sm" onClick={() => onDelete(q.id)}>✕</button>
                        )}
                      </td>
                    </tr>

                    {isRevOpen && (
                      <tr style={{ borderBottom: '1px solid #f0f2f5' }}>
                        <td colSpan={7} style={{ padding: '4px 20px 10px 20px', background: '#f8fafc', borderTop: '1px dashed #e2e8f0' }}>
                          <RevRow
                            label="Working Draft"
                            bold
                            date={q.updatedAt}
                            displayName={resolveEmail(emailMap, q.lastUpdatedBy)}
                            onClick={() => { setOpenRevs(null); onOpen(q.id); }}
                          />
                          {q.revisions.map((r: QuoteRevision) => (
                            <RevRow
                              key={r.id}
                              label={`Rev ${r.revNumber}`}
                              revNote={r.revNote}
                              date={r.createdAt}
                              displayName={resolveEmail(emailMap, r.createdBy)}
                              onClick={() => { setOpenRevs(null); onOpen(q.id, r.id); }}
                            />
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredDotId && statusCache[hoveredDotId] && (
        <StatusTooltip
          entry={statusCache[hoveredDotId]}
          pos={tooltipPos}
          onMouseEnter={cancelHide}
          onMouseLeave={startHide}
        />
      )}
    </div>
  );
}
