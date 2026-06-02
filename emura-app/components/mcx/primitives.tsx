'use client';

import type { ReactNode } from 'react';
import Icon from './Icon';

/* ---- Chip: pill status tag ---- */
type ChipKind = 'ok' | 'err' | 'warn' | 'neutral' | 'accent';
export function Chip({ kind = 'neutral', children, style }: { kind?: ChipKind; children: ReactNode; style?: React.CSSProperties }) {
  return <span className={`mcx-chip is-${kind}`} style={style}>{children}</span>;
}

/* ---- Note: inline info/warning banner (replaces pop-ups) ---- */
type NoteKind = 'info' | 'accent' | 'warn';
export function Note({ kind = 'info', icon, children, style }: { kind?: NoteKind; icon?: string; children: ReactNode; style?: React.CSSProperties }) {
  const cls = kind === 'info' ? 'mcx-note' : `mcx-note is-${kind}`;
  const ic = icon ?? (kind === 'warn' ? 'alert' : 'info');
  return (
    <div className={cls} style={style}>
      <Icon name={ic} size={14} className="mcx-note-ic" />
      <span>{children}</span>
    </div>
  );
}

/* ---- Grip: 2×3 dot drag handle ---- */
export function Grip() {
  return (
    <span className="mcx-grip" aria-hidden>
      {[0, 1, 2].map(i => <i key={i}><span /><span /></i>)}
    </span>
  );
}

/* ---- Chk: square checkbox ---- */
export function Chk({ on, onChange, title }: { on: boolean; onChange?: (v: boolean) => void; title?: string }) {
  return (
    <button type="button" className={'mcx-chk' + (on ? ' on' : '')} title={title}
      onClick={() => onChange?.(!on)} aria-pressed={on}>
      {on && <Icon name="check" size={11} sw={2.6} />}
    </button>
  );
}

/* ---- BarX: proportional cost bar ---- */
export function BarX({ pct, color, track }: { pct: number; color: string; track?: string }) {
  return (
    <div className="mcx-bar-track" style={track ? { background: track } : undefined}>
      <div className="mcx-bar-fill" style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }} />
    </div>
  );
}

/* ---- HelpI: the "i" affordance next to a label (carries a tooltip) ---- */
export function HelpI({ tip }: { tip?: string }) {
  if (!tip) return null;
  return <span className="mcx-help-i" title={tip}>i</span>;
}

/* category → ramp color, mirrors the design's CAT map */
export const CAT_COLOR: Record<string, string> = {
  Subcontract:      'var(--cat-1)',
  'Direct Labor':   'var(--cat-2)',
  Material:         'var(--cat-3)',
  'Indirect Labor': 'var(--cat-4)',
  Equipment:        'var(--cat-5)',
};
