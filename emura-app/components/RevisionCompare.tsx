'use client';

import { useState, useEffect } from 'react';
import type { AppState, RevisionDiff } from '@/lib/calculations';
import { computeRevisionDiff } from '@/lib/calculations';
import type { QuoteRevision } from '@/lib/db';
import { fmtC } from '@/lib/format';

interface Props {
  workingDraft: AppState;
  revisions: QuoteRevision[];
  loadRevision: (revisionId: string) => Promise<AppState | null>;
  onClose: () => void;
}

const DRAFT = 'draft';

const selStyle: React.CSSProperties = { padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, maxWidth: 260 };

export default function RevisionCompare({ workingDraft, revisions, loadRevision, onClose }: Props) {
  const options = [
    { id: DRAFT, label: 'Working Draft' },
    ...revisions.map(r => ({ id: r.id, label: `Rev ${r.revNumber}${r.revNote ? ' — ' + r.revNote : ''}` })),
  ];

  const [aId, setAId] = useState(revisions[0]?.id ?? DRAFT);
  const [bId, setBId] = useState(DRAFT);
  const [diff, setDiff] = useState<RevisionDiff | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const [a, b] = await Promise.all([
        aId === DRAFT ? Promise.resolve(workingDraft) : loadRevision(aId),
        bId === DRAFT ? Promise.resolve(workingDraft) : loadRevision(bId),
      ]);
      if (cancelled) return;
      setDiff(a && b ? computeRevisionDiff(a, b) : null);
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, bId]);

  const annualDelta = diff ? diff.toAnnualTotal - diff.fromAnnualTotal : 0;
  const deltaColor = (d: number) => d > 0.005 ? '#dc2626' : d < -0.005 ? '#16a34a' : '#888';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, maxWidth: 900, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,.2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a2940' }}>Compare Revisions</span>
          <button className="btn btn-neu btn-sm" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#555' }}>
              From
              <select value={aId} onChange={e => setAId(e.target.value)} style={selStyle}>
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <span style={{ color: '#94a3b8' }}>→</span>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#555' }}>
              To
              <select value={bId} onChange={e => setBId(e.target.value)} style={selStyle}>
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>

          {loading && <p className="empty-msg">Loading…</p>}

          {!loading && !diff && <p className="empty-msg">Could not load one of the selected revisions.</p>}

          {!loading && diff && aId === bId && (
            <p className="empty-msg">Select two different revisions to compare.</p>
          )}

          {!loading && diff && aId !== bId && (
            <>
              {/* Cost deltas */}
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2940', margin: '4px 0 6px' }}>Cost changes</div>
              {diff.costDeltas.length === 0 ? (
                <p className="empty-msg" style={{ padding: '6px 0' }}>No comparable FG/break costs.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left',  padding: '6px 8px' }}>Finished Good</th>
                      <th style={{ textAlign: 'left',  padding: '6px 8px' }}>Break</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>From $/unit</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>To $/unit</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Δ $/unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.costDeltas.map((c, i) => {
                      const d = c.toTotal - c.fromTotal;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f2f5' }}>
                          <td style={{ padding: '6px 8px' }}>{c.fgName}</td>
                          <td style={{ padding: '6px 8px', color: '#555' }}>{c.breakLabel}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(c.fromTotal, 4)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(c.toTotal, 4)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: deltaColor(d) }}>
                            {d >= 0 ? '+' : ''}{fmtC(d, 4)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: '2px solid #dde' }}>
                      <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700 }}>Total annual cost</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(diff.fromAnnualTotal, 0)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtC(diff.toAnnualTotal, 0)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: deltaColor(annualDelta) }}>
                        {annualDelta >= 0 ? '+' : ''}{fmtC(annualDelta, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Field-by-field changes */}
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a2940', margin: '16px 0 6px' }}>Detailed changes</div>
              {diff.sections.length === 0 && <p className="empty-msg" style={{ padding: '6px 0' }}>No field differences.</p>}
              {diff.sections.map(sec => (
                <div key={sec.title} style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#1a2940', marginBottom: 4 }}>{sec.title}</div>
                  {sec.added.map((nm, i) => (
                    <div key={`a-${i}`} style={{ fontSize: 12.5, color: '#16a34a', paddingLeft: 8 }}>+ added: {nm}</div>
                  ))}
                  {sec.removed.map((nm, i) => (
                    <div key={`r-${i}`} style={{ fontSize: 12.5, color: '#dc2626', paddingLeft: 8 }}>− removed: {nm}</div>
                  ))}
                  {sec.changed.map((ch, i) => (
                    <div key={`c-${i}`} style={{ paddingLeft: 8, marginTop: 2 }}>
                      {ch.name && <span style={{ fontSize: 12.5, fontWeight: 500 }}>{ch.name}</span>}
                      {ch.fields.map((f, j) => (
                        <div key={j} style={{ fontSize: 12, color: '#555', paddingLeft: 12 }}>
                          {f.label}: <span style={{ color: '#888' }}>{f.from || '∅'}</span> → <span style={{ color: '#1a2940' }}>{f.to || '∅'}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
