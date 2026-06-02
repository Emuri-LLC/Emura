'use client';

import type { ReactNode } from 'react';
import Icon from './Icon';

interface SectionCardProps {
  icon?: string;
  iconColor?: string;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;          // arbitrary node in the header, before the action button
  action?: string;           // label for the primary "+ Action" button
  onAction?: () => void;
  bodyPad?: boolean;         // false = full-bleed (for tables)
  children: ReactNode;
}

/** Titled card with an optional right slot and a primary "+ Action" header button. */
export default function SectionCard({
  icon, iconColor, title, sub, right, action, onAction, bodyPad = true, children,
}: SectionCardProps) {
  return (
    <div className="mcx-card">
      <div className="mcx-card-head">
        {icon && <Icon name={icon} size={15} style={{ color: iconColor || 'var(--ink-3)' }} />}
        <span className="mcx-card-title">{title}</span>
        {sub && <span className="mcx-card-sub">{sub}</span>}
        <div className="mcx-spacer" />
        {right}
        {action && (
          <button className="mcx-btn is-sm is-primary" onClick={onAction}>
            <Icon name="plus" size={12} />{action}
          </button>
        )}
      </div>
      {bodyPad ? <div className="mcx-card-body">{children}</div> : children}
    </div>
  );
}
