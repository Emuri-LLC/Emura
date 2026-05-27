'use client';

import React, { useState } from 'react';
import type { QuoteSummary, QuoteRevision } from '@/lib/db';

interface Props {
  quotes:   QuoteSummary[];
  userId:   string;
  role:     string;
  emailMap: Record<string, string>;
  onOpen:   (id: string, revisionId?: string) => void;
  onNew:    () => void;
  onDelete: (id: string) => void;
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

export default function QuotesList({ quotes, userId, role, emailMap, onOpen, onNew, onDelete }: Props) {
  const canEdit = role === 'admin' || role === 'estimator';
  const [search,   setSearch]   = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('updatedAt');
  const [sortAsc,  setSortAsc]  = useState(false);
  const [openRevs, setOpenRevs] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key === 'quoteNumber'); }
  }

  const sq = search.toLowerCase();
  const filtered = search
    ? quotes.filter(q =>
        q.name.toLowerCase().includes(sq) ||
        q.customer.toLowerCase().includes(sq) ||
        fmtQuoteNum(q.quoteNumber).toLowerCase().includes(sq)
      )
    : quotes;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'quoteNumber': cmp = (a.quoteNumber ?? 0) - (b.quoteNumber ?? 0); break;
      case 'name':        cmp = (a.name || '').localeCompare(b.name || ''); break;
      case 'customer':    cmp = (a.customer || '').localeCompare(b.customer || ''); break;
      case 'updatedAt':   cmp = (a.updatedAt || '').localeCompare(b.updatedAt || ''); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="card" style={{ maxWidth: 960, margin: '32px auto' }}>
      <div className="card-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>My Quotes</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search quotes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, width: 190 }}
          />
          {canEdit && (
            <button className="btn btn-add btn-sm" onClick={onNew}>+ New Quote</button>
          )}
        </div>
      </div>

      <div className="card-body" style={{ padding: 0 }}>
        {sorted.length === 0 ? (
          <p className="empty-msg" style={{ padding: '24px 16px' }}>
            {quotes.length === 0
              ? (canEdit ? 'No quotes yet. Click + New Quote to get started.' : 'No quotes yet.')
              : 'No quotes match your search.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ ...thBase, textAlign: 'left',  width: 78   }} onClick={() => handleSort('quoteNumber')}>#&nbsp;{sortIndicator('quoteNumber', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'left'               }} onClick={() => handleSort('name')}>Quote Name&nbsp;{sortIndicator('name', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'left'               }} onClick={() => handleSort('customer')}>Customer&nbsp;{sortIndicator('customer', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'right'              }} onClick={() => handleSort('updatedAt')}>Last Updated&nbsp;{sortIndicator('updatedAt', sortKey, sortAsc)}</th>
                <th style={{ ...thBase, textAlign: 'right', cursor: 'default' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(q => {
                const maxRev    = q.revisions[0]?.revNumber ?? 0;
                const isRevOpen = openRevs === q.id;
                return (
                  <React.Fragment key={q.id}>
                    <tr style={{ borderBottom: isRevOpen ? 'none' : '1px solid #f0f2f5' }}>
                      <td style={{ padding: '8px 12px', color: '#888', fontFamily: 'monospace', fontSize: 12 }}>
                        {fmtQuoteNum(q.quoteNumber)}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{q.name || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#555' }}>{q.customer || '—'}</td>
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
                        <td colSpan={5} style={{ padding: '4px 20px 10px 20px', background: '#f8fafc', borderTop: '1px dashed #e2e8f0' }}>
                          {/* Working Draft */}
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
    </div>
  );
}

// ── Revision row (extracted to avoid inner-component anti-pattern) ─────────

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
