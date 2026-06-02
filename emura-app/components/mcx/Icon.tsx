// Inline 18×18 stroke icons for the cool-dark (.mcx) design system.
// Ported from the design handoff's ICONSX. 1.5px default stroke weight.

import type { CSSProperties } from 'react';

export const ICONS: Record<string, string> = {
  back:    'M11 4 5.5 9 11 14',
  chevL:   'M11 4 6 9l5 5',
  chevR:   'M7 4l5 5-5 5',
  chevD:   'M4 7l5 5 5-5',
  chevU:   'M4 11l5-5 5 5',
  undo:    'M6 8H12a3.5 3.5 0 0 1 0 7H8M6 8l3-3M6 8l3 3',
  redo:    'M14 8H8a3.5 3.5 0 0 0 0 7h4M14 8l-3-3M14 8l-3 3',
  export:  'M10 3v9M10 3 6.5 6.5M10 3l3.5 3.5M4 13v3h12v-3',
  import:  'M10 12V3M10 12 6.5 8.5M10 12l3.5-3.5M4 13v3h12v-3',
  compare: 'M10 3v14M5 6 3 9l2 3M15 6l2 3-2 3',
  info:    'M9 8.2v4.3M9 5.6v.1',
  search:  'M8.2 8.2 12 12M9.5 6a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
  plus:    'M9 4v10M4 9h10',
  x:       'M5 5l8 8M13 5l-8 8',
  alert:   'M9 3 2 15h14L9 3ZM9 8v3M9 13v.1',
  check:   'M4 9.5 7.5 13 14 5.5',
  bolt:    'M10 2 4 10h4l-1 6 6-8H9l1-6Z',
  gear:    'M9 11.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM9 2.6v1.6M9 13.8v1.6M15.4 9h-1.6M4.2 9H2.6M13.5 4.5l-1.1 1.1M5.6 12.4l-1.1 1.1M13.5 13.5l-1.1-1.1M5.6 5.6 4.5 4.5',
  doc:     'M5 3h6l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
  sum:     'M4 3h10M4 3l5 6-5 6h10',
  dot:     'M9 9h.01',
  layers:  'M9 2.5 16 6 9 9.5 2 6l7-3.5ZM2 10l7 3.5L16 10',
  logout:  'M7 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 12l3-3-3-3M14 9H6',
  trash:   'M4 5h10M7 5V3h4v2M5 5l1 10h6l1-10',
};

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: string;
  size?: number;
  sw?: number;
  style?: CSSProperties;
  className?: string;
}

export default function Icon({ name, size = 15, sw = 1.5, style, className }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ flex: '0 0 auto', ...style }}
      aria-hidden
    >
      <path d={ICONS[name] || ''} />
    </svg>
  );
}
