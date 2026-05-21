'use client';

import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany]   = useState('');
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill email if an invite token is present in the URL
  useEffect(() => {
    const inviteEmail = searchParams.get('email');
    if (inviteEmail) { setEmail(inviteEmail); setMode('signup'); }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
    } else {
      if (!company.trim()) { setError('Company name is required.'); setLoading(false); return; }
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
      if (error) { setLoading(false); setError(error.message); return; }
      // Pass uid explicitly — auth.uid() is null when email confirmation is enabled
      const { error: rpcError } = await supabase.rpc('create_org_for_new_user', {
        org_name: company.trim(),
        uid: signUpData.user?.id,
      });
      setLoading(false);
      if (rpcError) { setError('Account created but org setup failed: ' + rpcError.message); return; }
    }

    // If this login came from an invite link, redirect back to the join page
    const token = searchParams.get('token');
    router.push(token ? `/join?token=${token}` : '/');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 9px', border: '1px solid #cdd',
    borderRadius: 3, fontSize: 13, boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#eef0f4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,.12)',
        padding: '36px 40px', width: 340,
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a2940', marginBottom: 6 }}>
          ⚙ Emura
        </h1>
        <p style={{ fontSize: 12.5, color: '#666', marginBottom: 24 }}>
          Manufacturing Cost Estimator
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#444', display: 'block', marginBottom: 3 }}>
              Email
            </label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#444', display: 'block', marginBottom: 3 }}>
                Company Name
              </label>
              <input type="text" required value={company} onChange={e => setCompany(e.target.value)} style={inputStyle} />
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: '#444', display: 'block', marginBottom: 3 }}>
              Password
            </label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 3,
              padding: '7px 10px', fontSize: 12, color: '#991b1b', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '9px', background: '#1a2940', color: '#fff',
            border: 'none', borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#666' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
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
