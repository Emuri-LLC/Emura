'use client';

import type { QuoteSummary } from '@/lib/db';

interface Props {
  quotes:   QuoteSummary[];
  userId:   string;
  role:     string;
  onOpen:   (id: string) => void;
  onNew:    () => void;
  onDelete: (id: string) => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QuotesList({ quotes, userId, role, onOpen, onNew, onDelete }: Props) {
  const canEdit = role === 'admin' || role === 'estimator';

  return (
    <div className="card" style={{ maxWidth: 760, margin: '32px auto' }}>
      <div className="card-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>My Quotes</span>
        {canEdit && (
          <button className="btn btn-add btn-sm" onClick={onNew}>+ New Quote</button>
        )}
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {quotes.length === 0 ? (
          <p className="empty-msg" style={{ padding: '24px 16px' }}>
            No quotes yet.{canEdit ? ' Click + New Quote to get started.' : ''}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <th style={{ textAlign: 'left',  padding: '8px 12px', fontWeight: 600 }}>Quote Name</th>
                <th style={{ textAlign: 'left',  padding: '8px 12px', fontWeight: 600 }}>Customer</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Last Updated</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid #f0f2f5' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{q.name || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#555' }}>{q.customer || '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontSize: 12 }}>
                    {fmtDate(q.updatedAt)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-neu btn-sm" onClick={() => onOpen(q.id)}
                      style={{ marginRight: 6 }}>Open</button>
                    {(role === 'admin' || q.createdBy === userId) && (
                      <button className="btn btn-del btn-sm" onClick={() => onDelete(q.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
