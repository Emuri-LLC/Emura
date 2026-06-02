'use client';

import Icon from './Icon';

interface UtilBarProps {
  mode: 'list' | 'editor';
  quoteName?: string;
  revision?: string;
  saveStatus?: string;
  isAdmin?: boolean;
  canEdit?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onBack?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCompare?: () => void;
  onExport?: () => void;
  onImport?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveRevision?: () => void;
  onNew?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}

/** Tier-1 utility bar. Presentational — all behavior comes through props. */
export default function UtilBar({
  mode, quoteName, revision, saveStatus, isAdmin, canEdit,
  canUndo, canRedo, onBack, onUndo, onRedo, onCompare, onExport,
  onImport, onSaveRevision, onNew, onSettings, onLogout,
}: UtilBarProps) {
  const editor = mode === 'editor';
  return (
    <div className="mcx-util">
      {editor && (
        <>
          <button className="mcx-back" onClick={onBack} title="Back to quotes list">
            <Icon name="back" size={14} />Quotes
          </button>
          <div className="mcx-divider" />
        </>
      )}

      <div className="mcx-brand">
        <div className="mcx-brand-mark">E</div>
        <span className="mcx-brand-name">Estimator</span>
        {editor
          ? <span className="mcx-brand-sub">· {quoteName?.trim() || 'Untitled'}{revision?.trim() ? ` — Rev ${revision.trim()}` : ''}</span>
          : <span className="mcx-brand-sub">· Quotes</span>}
      </div>

      <div className="mcx-spacer" />

      {editor && (
        <>
          <span className="mcx-save"><span className="mcx-livedot" />{saveStatus || 'Saved'}</span>
          <div className="mcx-divider" />
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="mcx-btn is-quiet is-icon" title="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}><Icon name="undo" size={15} /></button>
            <button className="mcx-btn is-quiet is-icon" title="Redo (⌘⇧Z)" onClick={onRedo} disabled={!canRedo}><Icon name="redo" size={15} /></button>
          </div>
          <div className="mcx-divider" />
          <button className="mcx-btn is-quiet" onClick={onCompare}><Icon name="compare" size={14} />Compare</button>
          <label className="mcx-btn is-quiet" style={{ margin: 0 }}>
            <Icon name="import" size={14} />Import
            <input type="file" accept=".json" onChange={onImport} style={{ display: 'none' }} />
          </label>
          <button className="mcx-btn" onClick={onExport}><Icon name="export" size={14} />Export</button>
          {canEdit && (
            <button className="mcx-btn is-primary" onClick={onSaveRevision}><Icon name="check" size={14} />Save Revision</button>
          )}
          {isAdmin && <button className="mcx-btn is-quiet is-icon" title="Settings" onClick={onSettings}><Icon name="gear" size={15} /></button>}
          <button className="mcx-btn is-quiet is-icon" title="Log out" onClick={onLogout}><Icon name="logout" size={15} /></button>
        </>
      )}

      {!editor && (
        <>
          {canEdit && <button className="mcx-btn is-primary" onClick={onNew}><Icon name="plus" size={13} />New Quote</button>}
          {isAdmin && <button className="mcx-btn is-quiet is-icon" title="Settings" onClick={onSettings}><Icon name="gear" size={15} /></button>}
          <button className="mcx-btn is-quiet is-icon" title="Log out" onClick={onLogout}><Icon name="logout" size={15} /></button>
        </>
      )}
    </div>
  );
}
