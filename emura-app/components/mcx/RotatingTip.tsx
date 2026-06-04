'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Note } from './primitives';

// Accurate, app-true tips (drawn from the spec). The first corrects the old
// "every keystroke recalculates" claim — values commit on blur, not per keystroke.
const TIPS: ReactNode[] = [
  <>Numbers commit when you leave a field — the ribbon total and every tab update at once. There&rsquo;s no <b>Calculate</b> button.</>,
  <>Quantity fields accept fractions — type <b>1/4</b> and it&rsquo;s read as 0.25.</>,
  <>Paste an image (<b>Ctrl/Cmd+V</b>) straight into Notes to embed it.</>,
  <>Drag the grip handle at the left of any table row to reorder it.</>,
  <>Set a <b>Primary</b> FG + break on the Finished Goods tab to drive takt, the pc/hr helpers, and the Est. $/unit column.</>,
  <>Mark a BOM line <b>Standard</b> for one flat price that applies at every volume break.</>,
  <>Made a mistake? <b>Ctrl/Cmd+Z</b> undoes — the app keeps a deep history instead of pop-ups.</>,
  <>Use <b>Export</b> / <b>Import</b> (JSON) to share or back up a quote, and <b>Save Revision</b> + <b>Compare</b> to diff two versions.</>,
  <>Quote Review compares your costs against the org library and flags possible under-estimates.</>,
];

export default function RotatingTip({ intervalMs = 9000 }: { intervalMs?: number }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % TIPS.length), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return <Note kind="accent" icon="info">{TIPS[i]}</Note>;
}
