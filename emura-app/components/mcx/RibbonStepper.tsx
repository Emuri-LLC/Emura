'use client';

import { Fragment } from 'react';
import Icon from './Icon';
import AnnualCost from './AnnualCost';
import type { TabStatus, TabStatusEntry } from '@/lib/tabStatus';

interface RibbonTab { id: string; label: string }

type NodeState = TabStatus | 'cur';

interface RibbonStepperProps {
  tabs: RibbonTab[];
  statuses: TabStatusEntry[];   // aligned to tabs
  current: number;              // active tab index
  onNavigate: (index: number) => void;
  annual: { eyebrow: string; figure: string; unitSuffix?: string };
}

function glyphFor(status: NodeState) {
  switch (status) {
    case 'ok':   return <Icon name="check" size={10} sw={2.4} />;
    case 'err':  return <Icon name="x" size={10} sw={2.4} />;
    case 'warn': return <Icon name="alert" size={10} sw={2.2} />;
    case 'cur':  return <Icon name="bolt" size={10} sw={2.2} />;
    default:     return <Icon name="dot" size={8} sw={2.4} />;
  }
}

export default function RibbonStepper({ tabs, statuses, current, onNavigate, annual }: RibbonStepperProps) {
  return (
    <div className="mcx-ribbon">
      <div className="mcx-step">
        {tabs.map((t, i) => {
          const base = statuses[i]?.status ?? 'idle';
          const eff: NodeState = i === current ? 'cur' : base;
          const prevBase = statuses[i - 1]?.status ?? 'idle';
          const connDone = i > 0 && prevBase === 'ok' && base !== 'idle';
          const count = statuses[i]?.count;
          return (
            <Fragment key={t.id}>
              {i > 0 && <div className={'mcx-step-conn' + (connDone ? ' done' : '')} />}
              <button
                type="button"
                className={'mcx-step-item ' + eff}
                onClick={() => onNavigate(i)}
                title={t.label}
              >
                <span className="mcx-step-node">
                  {glyphFor(eff)}
                  {base === 'err' && count != null && count > 0 && (
                    <span className="mcx-step-badge">{count}</span>
                  )}
                </span>
                <span className="mcx-step-label">{t.label}</span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <AnnualCost {...annual} />
    </div>
  );
}
