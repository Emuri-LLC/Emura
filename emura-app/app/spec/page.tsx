import fs from 'node:fs';
import path from 'node:path';

// Login-gated by proxy.ts (every route except /login and /join requires a
// session). Statically rendered: the canonical spec HTML is read at BUILD time
// and embedded into an isolated <iframe srcDoc> so the spec's own bare-tag CSS
// can't leak into (or be clobbered by) the app's dark theme.
export const dynamic = 'force-static';

export const metadata = { title: 'Emura — Product Specification' };

function loadSpec(): string {
  // Canonical doc lives at the repo root, one level above the Next app root
  // (process.cwd() === emura-app during build, locally and on Vercel).
  const candidates = [
    path.join(process.cwd(), '..', 'manufacturing-cost-estimator-spec.html'),
    path.join(process.cwd(), 'manufacturing-cost-estimator-spec.html'),
  ];
  for (const p of candidates) {
    try { return fs.readFileSync(p, 'utf8'); } catch { /* try next candidate */ }
  }
  return '<!doctype html><html><body style="font-family:sans-serif;padding:40px;color:#1a1a2e">'
    + 'Specification document is currently unavailable.</body></html>';
}

export default function SpecPage() {
  const html = loadSpec();
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px', background: '#1a2940' }}>
        <a href="/" style={{ color: '#93c5fd', textDecoration: 'none', fontFamily: 'sans-serif', fontSize: 13 }}>← Back to Emura</a>
        <span style={{ color: '#cbd5e1', fontFamily: 'sans-serif', fontSize: 13 }}>Product Specification</span>
      </div>
      <iframe
        title="Emura — Product Specification"
        srcDoc={html}
        style={{ flex: '1 1 auto', width: '100%', border: 0, background: '#fafafa' }}
      />
    </div>
  );
}
