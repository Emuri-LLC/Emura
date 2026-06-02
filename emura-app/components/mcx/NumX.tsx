'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';

interface NumXProps {
  value: number | string;
  onCommit: (n: number) => void;
  width?: number | string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;       // e.g. '$' or '/hr', shown right of the number
  placeholder?: string;
  disabled?: boolean;
  /** When true an empty input commits 0 but renders blank (for optional fields). */
  blankZero?: boolean;
}

/**
 * Numeric input with up/down steppers, matching the .mcx design.
 * Uncontrolled (defaultValue + onBlur) per the project's input contract — the
 * parent must key this element with `…+resetKey` so it remounts on undo/import/new.
 */
export default function NumX({
  value, onCommit, width = '100%', min, max, step = 1,
  suffix, placeholder, disabled, blankZero,
}: NumXProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState(false);

  function commit() {
    const raw = inputRef.current?.value ?? '';
    let n = Number(raw);
    if (!Number.isFinite(n)) n = min ?? 0;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    onCommit(n);
  }

  function bump(dir: 1 | -1) {
    if (disabled) return;
    const cur = Number(inputRef.current?.value) || 0;
    let n = cur + dir * step;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    if (inputRef.current) inputRef.current.value = String(n);
    onCommit(n);
  }

  const initial = blankZero && !Number(value) ? '' : value;

  return (
    <div className={'mcx-num' + (focus ? ' is-focus' : '')} style={{ width }}>
      {suffix === '$' && <span className="mcx-affix" style={{ paddingRight: 0 }}>$</span>}
      <input
        ref={inputRef}
        className="num"
        type="text"
        inputMode="decimal"
        defaultValue={initial}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); commit(); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
        }}
      />
      {suffix && suffix !== '$' && <span className="mcx-affix" style={{ paddingLeft: 0 }}>{suffix}</span>}
      {!disabled && (
        <div className="mcx-num-steps">
          <button type="button" tabIndex={-1} onClick={() => bump(1)}><Icon name="chevU" size={10} sw={2} /></button>
          <button type="button" tabIndex={-1} onClick={() => bump(-1)}><Icon name="chevD" size={10} sw={2} /></button>
        </div>
      )}
    </div>
  );
}
