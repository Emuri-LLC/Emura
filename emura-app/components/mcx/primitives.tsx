'use client';

import { useState, type ReactNode } from 'react';
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

/* ---- HelpI: the "i" affordance next to a label (carries a styled tooltip) ----
   The bubble is position:fixed (anchored to the icon via getBoundingClientRect)
   so it escapes the cards'/tables' overflow:hidden clipping. */
export function HelpI({ tip }: { tip?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!tip) return null;
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top - 6 });
  };
  return (
    <span
      className="mcx-help-i" aria-label={tip} tabIndex={0}
      onMouseEnter={e => show(e.currentTarget)}
      onMouseLeave={() => setPos(null)}
      onFocus={e => show(e.currentTarget)}
      onBlur={() => setPos(null)}
    >
      i
      {pos && <span className="mcx-help-tip" role="tooltip" style={{ left: pos.x, top: pos.y }}>{tip}</span>}
    </span>
  );
}

/* category → ramp color, mirrors the design's CAT map */
export const CAT_COLOR: Record<string, string> = {
  Subcontract:      'var(--cat-1)',
  'Direct Labor':   'var(--cat-2)',
  Material:         'var(--cat-3)',
  'Indirect Labor': 'var(--cat-4)',
  Equipment:        'var(--cat-5)',
};
