'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

function JoinContent() {
  const [status, setStatus] = useState<'checking' | 'accepting' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('');
  const router       = useRouter();
  const searchParams = useSearchParams();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const token = searchParams.get('token');
    router.push(token ? `/login?token=${token}` : '/login');
  }

  useEffect(() => {
    async function run() {
      const token = searchParams.get('token');
      if (!token) { setStatus('error'); setMessage('No invite token found in the URL.'); return; }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?token=${token}`);
        return;
      }

      setStatus('accepting');
      const { error } = await supabase.rpc('accept_org_invite', { invite_token: token });

      if (error) {
        setStatus('error');
        setMessage(error.message || 'Invalid or expired invite token.');
        return;
      }

      setStatus('success');
      setTimeout(() => router.push('/'), 1500);
    }

    run();
  }, [searchParams, router]);

  const center: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#eef0f4',
  };
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 6, boxShadow: '0 2px 12px rgba(0,0,0,.12)',
    padding: '36px 40px', width: 340, textAlign: 'center',
  };

  return (
    <div style={center}>
      <div style={card}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a2940', marginBottom: 16 }}>⚙ Emura</h1>

        {(status === 'checking' || status === 'accepting') && (
          <p style={{ color: '#555', fontSize: 13 }}>
            {status === 'checking' ? 'Verifying invite…' : 'Joining organization…'}
          </p>
        )}

        {status === 'success' && (
          <div>
            <p style={{ color: '#166534', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              You've joined the organization!
            </p>
            <p style={{ color: '#888', fontSize: 12 }}>Redirecting you to the app…</p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: '#991b1b', fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              Invite failed
            </p>
            <p style={{ color: '#555', fontSize: 12, marginBottom: 8 }}>{message}</p>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 16, lineHeight: 1.5 }}>
              Make sure you're signed in with the exact email address this invite was sent to. If you're signed in as someone else, sign out first.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={handleSignOut}
                style={{ padding: '8px 16px', background: '#fff', color: '#1a2940',
                  border: '1px solid #1a2940', borderRadius: 3, fontSize: 13, cursor: 'pointer' }}
              >
                Sign Out
              </button>
              <button
                onClick={() => router.push('/')}
                style={{ padding: '8px 16px', background: '#1a2940', color: '#fff',
                  border: 'none', borderRadius: 3, fontSize: 13, cursor: 'pointer' }}
              >
                Go to App
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  );
}
