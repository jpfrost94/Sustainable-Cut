import React, { useState } from 'react';

function StatusTone(status) {
  if (status === 'synced') return '#16a34a';
  if (status === 'syncing') return '#3b82f6';
  if (status === 'error') return '#dc2626';
  if (status === 'disabled') return '#6b7280';
  return '#a3a3a3';
}

export default function CloudSyncCard({ sync, Card, Label, Input, S, compact = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localMsg, setLocalMsg] = useState('');

  const busy = sync.authBusy || sync.hydrating;

  if (!sync.cloudConfigured) {
    return (
      <Card>
        <h3 style={S.cardTitle}>CLOUD SYNC (OPTIONAL)</h3>
        <p style={{ ...S.muted, marginTop: 8 }}>
          Supabase is not configured. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable cross-device sync.
        </p>
      </Card>
    );
  }

  if (sync.session?.user) {
    return (
      <Card>
        <h3 style={S.cardTitle}>CLOUD SYNC</h3>
        <p style={{ ...S.muted, marginTop: 8 }}>
          Signed in as <strong style={{ color: '#fff' }}>{sync.userEmail}</strong>
        </p>
        <p style={{ marginTop: 6, color: StatusTone(sync.syncInfo.status), fontSize: '0.8rem' }}>
          {sync.syncInfo.message}
          {sync.syncInfo.lastSyncedAt ? ` (${new Date(sync.syncInfo.lastSyncedAt).toLocaleString()})` : ''}
        </p>
        {sync.syncInfo.error && <p style={{ marginTop: 4, color: '#f87171', fontSize: '0.78rem' }}>{sync.syncInfo.error}</p>}

        <div style={{ ...S.g2, marginTop: 8 }}>
          <button style={{ ...S.expBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => sync.syncNow()}>
            Sync Now
          </button>
          <button
            style={{ ...S.expBtn, opacity: busy ? 0.6 : 1 }}
            disabled={busy}
            onClick={async () => {
              if (!confirm('Replace local data with cloud data?')) return;
              await sync.pullFromCloud();
            }}
          >
            Restore Cloud
          </button>
          {!compact && (
            <button style={{ ...S.expBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => sync.pushToCloud()}>
              Backup Local
            </button>
          )}
          <button style={{ ...S.expBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => sync.signOut()}>
            Sign Out
          </button>
        </div>
      </Card>
    );
  }

  const disabled = busy || !email || !password;

  return (
    <Card>
      <h3 style={S.cardTitle}>SIGN IN FOR CLOUD SYNC</h3>
      <p style={{ ...S.muted, marginTop: 8 }}>
        Use one account across all devices. Your profile and logs sync automatically.
      </p>
      <div style={{ marginTop: 10 }}>
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="you@email.com" />
      </div>
      <div style={{ marginTop: 8 }}>
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>

      <div style={{ ...S.g2, marginTop: 10 }}>
        <button
          style={{ ...S.expBtn, opacity: disabled ? 0.6 : 1 }}
          disabled={disabled}
          onClick={async () => {
            const res = await sync.signIn(email, password);
            setLocalMsg(res.ok ? 'Signed in.' : (res.error || 'Sign-in failed.'));
          }}
        >
          Sign In
        </button>
        <button
          style={{ ...S.expBtn, opacity: disabled ? 0.6 : 1 }}
          disabled={disabled}
          onClick={async () => {
            const res = await sync.signUp(email, password);
            setLocalMsg(res.ok ? 'Account created. Check your email if confirmation is enabled.' : (res.error || 'Sign-up failed.'));
          }}
        >
          Create Account
        </button>
      </div>

      {(localMsg || sync.syncInfo.error) && (
        <p style={{ marginTop: 8, color: sync.syncInfo.error ? '#f87171' : '#a3a3a3', fontSize: '0.78rem' }}>
          {sync.syncInfo.error || localMsg}
        </p>
      )}
    </Card>
  );
}
