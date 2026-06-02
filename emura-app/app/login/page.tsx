'use client';

import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [company, setCompany]     = useState('');
  const [mode, setMode]           = useState<'signin' | 'signup'>('signin');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const router       = useRouter();
  const searchParams = useSearchParams();

  const inviteToken = searchParams.get('token');
  const isInviteFlow = !!inviteToken;

  useEffect(() => {
    const inviteEmail = searchParams.get('email');
    // Switch to sign-up when arriving via an invite link (token param) or pre-filled email
    if (inviteEmail || inviteToken) {
      setMode('signup');
      if (inviteEmail) setEmail(inviteEmail);
    }
  }, [searchParams, inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
      const token = searchParams.get('token');
      router.push(token ? `/join?token=${token}` : '/');
    } else {
      if (!isInviteFlow && !company.trim()) { setError('Company name is required.'); setLoading(false); return; }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: company.trim() ? { company_name: company.trim() } : {},
          emailRedirectTo: isInviteFlow
            ? `${window.location.origin}/join?token=${inviteToken}`
            : window.location.origin,
        },
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setConfirmed(true);
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' };

  return (
    <div className="mcx" style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)', padding: '36px 40px', width: 340,
      }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-.01em' }}>
          <span style={{ color: 'var(--accent)' }}>⚙</span> Emura
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 24 }}>
          Manufacturing Cost Estimator
        </p>

        {confirmed ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ok-2)', marginBottom: 8 }}>
              Check your email
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 20, lineHeight: 1.5 }}>
              We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{email}</strong>.{' '}
              {isInviteFlow
                ? 'Click it to confirm your account and join the organization — you\'ll be taken straight into the app.'
                : 'Click it to activate your account, then sign in below.'}
            </p>
            {!isInviteFlow && (
              <button className="mcx-btn is-primary"
                onClick={() => { setConfirmed(false); setMode('signin'); }}
              >
                Go to Sign In
              </button>
            )}
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email</label>
                <input className="mcx-input" style={{ width: '100%' }} type="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              {mode === 'signup' && !isInviteFlow && (
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Company Name</label>
                  <input className="mcx-input" style={{ width: '100%' }} type="text" required value={company} onChange={e => setCompany(e.target.value)} />
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Password</label>
                <input className="mcx-input" style={{ width: '100%' }} type="password" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              {error && (
                <div style={{ background: 'var(--err-bg)', border: '1px solid var(--err-border)', borderRadius: 6,
                  padding: '7px 10px', fontSize: 12, color: 'var(--err)', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button type="submit" className="mcx-btn is-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--ink-3)' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-ink)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
