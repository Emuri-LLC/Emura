export const fmtN = (n: number, d = 0) =>
  isNaN(n) || !isFinite(n) ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtC = (n: number, d = 2) =>
  isNaN(n) ? '—' : '$' + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmt4 = (n: number) =>
  isNaN(n) ? '—' : n.toFixed(4);

export const fmtH = (n: number) =>
  isNaN(n) ? '—' : n.toFixed(1);

export const fmtP = (n: number) =>
  isNaN(n) ? '—' : n.toFixed(1) + '%';

export const fmtS = (n: number) =>
  isNaN(n) ? '—' : n.toFixed(2) + 's';
