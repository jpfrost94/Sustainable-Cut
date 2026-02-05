import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cloudConfigured, supabase } from './lib/cloudClient';

const TABLE = 'sc3_user_state';

function hasLocalData(profile, logs, weekly) {
  return Boolean(profile || Object.keys(logs || {}).length || Object.keys(weekly || {}).length);
}

function snapshotState(profile, logs, weekly) {
  return JSON.stringify({
    profile: profile ?? null,
    logs: logs ?? {},
    weekly: weekly ?? {},
  });
}

async function fetchRemote(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('profile, logs, weekly, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  return { data, error };
}

async function upsertRemote(userId, payload) {
  const next = {
    user_id: userId,
    profile: payload.profile ?? null,
    logs: payload.logs ?? {},
    weekly: payload.weekly ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(next, { onConflict: 'user_id' })
    .select('updated_at')
    .single();

  return { data, error };
}

export function useCloudSync({ loaded, profile, logs, weekly, saveProfile, saveLogs, saveWeekly }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!cloudConfigured);
  const [authBusy, setAuthBusy] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [syncInfo, setSyncInfo] = useState({
    status: cloudConfigured ? 'idle' : 'disabled',
    message: cloudConfigured ? 'Cloud sync is available.' : 'Cloud sync disabled (no Supabase env vars set).',
    lastSyncedAt: null,
    error: null,
  });

  const bootstrappedUserRef = useRef(null);
  const lastSyncedSnapshotRef = useRef('');

  const currentSnapshot = useMemo(
    () => snapshotState(profile, logs, weekly),
    [profile, logs, weekly]
  );

  const setStatus = useCallback((next) => {
    setSyncInfo((prev) => ({ ...prev, ...next }));
  }, []);

  const applyRemoteState = useCallback(async (remote, label) => {
    const remoteProfile = remote?.profile ?? null;
    const remoteLogs = remote?.logs ?? {};
    const remoteWeekly = remote?.weekly ?? {};

    await saveProfile(remoteProfile);
    await saveLogs(remoteLogs);
    await saveWeekly(remoteWeekly);

    lastSyncedSnapshotRef.current = snapshotState(remoteProfile, remoteLogs, remoteWeekly);
    setStatus({
      status: 'synced',
      message: label,
      lastSyncedAt: remote?.updated_at || new Date().toISOString(),
      error: null,
    });
  }, [saveProfile, saveLogs, saveWeekly, setStatus]);

  const pushLocalState = useCallback(async (label = 'Synced to cloud.') => {
    if (!session?.user?.id) return false;

    setStatus({ status: 'syncing', message: 'Syncing to cloud…', error: null });
    const { data, error } = await upsertRemote(session.user.id, { profile, logs, weekly });

    if (error) {
      setStatus({ status: 'error', message: 'Cloud sync failed.', error: error.message });
      return false;
    }

    lastSyncedSnapshotRef.current = snapshotState(profile, logs, weekly);
    setStatus({
      status: 'synced',
      message: label,
      lastSyncedAt: data?.updated_at || new Date().toISOString(),
      error: null,
    });

    return true;
  }, [session, profile, logs, weekly, setStatus]);

  useEffect(() => {
    if (!cloudConfigured) return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        setStatus({ status: 'error', message: 'Auth session check failed.', error: error.message });
      }

      setSession(data?.session || null);
      setAuthReady(true);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user?.id) {
        bootstrappedUserRef.current = null;
        setStatus({ status: 'idle', message: 'Signed out. Local mode active.', error: null });
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [setStatus]);

  useEffect(() => {
    if (!cloudConfigured || !authReady || !loaded) return;

    if (!session?.user?.id) {
      setHydrating(false);
      return;
    }

    if (bootstrappedUserRef.current === session.user.id) return;

    let cancelled = false;

    (async () => {
      setHydrating(true);
      setStatus({ status: 'syncing', message: 'Checking cloud data…', error: null });

      const { data, error } = await fetchRemote(session.user.id);
      if (cancelled) return;

      if (error) {
        setStatus({ status: 'error', message: 'Cloud read failed.', error: error.message });
        setHydrating(false);
        return;
      }

      bootstrappedUserRef.current = session.user.id;

      if (data) {
        await applyRemoteState(data, 'Cloud data loaded.');
        if (!cancelled) setHydrating(false);
        return;
      }

      if (hasLocalData(profile, logs, weekly)) {
        await pushLocalState('Uploaded existing local data to cloud.');
        if (!cancelled) setHydrating(false);
        return;
      }

      lastSyncedSnapshotRef.current = currentSnapshot;
      setStatus({ status: 'idle', message: 'Signed in. No cloud data yet.', error: null });
      setHydrating(false);
    })();

    return () => { cancelled = true; };
  }, [
    loaded,
    authReady,
    session,
    profile,
    logs,
    weekly,
    currentSnapshot,
    applyRemoteState,
    pushLocalState,
    setStatus,
  ]);

  useEffect(() => {
    if (!cloudConfigured || !authReady || !loaded || !session?.user?.id || hydrating) return;
    if (currentSnapshot === lastSyncedSnapshotRef.current) return;

    const timer = setTimeout(() => {
      pushLocalState('Auto-synced changes.');
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentSnapshot, loaded, authReady, session, hydrating, pushLocalState]);

  const signIn = useCallback(async (email, password) => {
    if (!cloudConfigured) return { ok: false, error: 'Cloud sync is not configured.' };

    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);

    if (error) {
      setStatus({ status: 'error', message: 'Sign-in failed.', error: error.message });
      return { ok: false, error: error.message };
    }

    setStatus({ status: 'syncing', message: 'Signed in. Syncing…', error: null });
    return { ok: true };
  }, [setStatus]);

  const signUp = useCallback(async (email, password) => {
    if (!cloudConfigured) return { ok: false, error: 'Cloud sync is not configured.' };

    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setAuthBusy(false);

    if (error) {
      setStatus({ status: 'error', message: 'Sign-up failed.', error: error.message });
      return { ok: false, error: error.message };
    }

    setStatus({
      status: 'idle',
      message: 'Account created. Check your email if confirmation is required.',
      error: null,
    });
    return { ok: true };
  }, [setStatus]);

  const signOut = useCallback(async () => {
    if (!cloudConfigured) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    setAuthBusy(false);

    if (error) {
      setStatus({ status: 'error', message: 'Sign-out failed.', error: error.message });
      return { ok: false, error: error.message };
    }

    setStatus({ status: 'idle', message: 'Signed out. Local mode active.', error: null });
    return { ok: true };
  }, [setStatus]);

  const signInOAuth = useCallback(async (provider) => {
    if (!cloudConfigured) return { ok: false, error: 'Cloud sync is not configured.' };
    if (!provider) return { ok: false, error: 'Missing OAuth provider.' };

    setAuthBusy(true);
    setStatus({ status: 'syncing', message: 'Redirecting to provider…', error: null });

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}${import.meta.env.BASE_URL}`
      : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    setAuthBusy(false);

    if (error) {
      setStatus({ status: 'error', message: 'SSO sign-in failed.', error: error.message });
      return { ok: false, error: error.message };
    }

    // On success, the browser typically redirects immediately.
    return { ok: true };
  }, [setStatus]);

  const syncNow = useCallback(async () => {
    if (!session?.user?.id) return { ok: false, error: 'Sign in first.' };
    const ok = await pushLocalState('Manual sync complete.');
    return ok ? { ok: true } : { ok: false, error: 'Sync failed.' };
  }, [session, pushLocalState]);

  const pullFromCloud = useCallback(async () => {
    if (!session?.user?.id) return { ok: false, error: 'Sign in first.' };

    setHydrating(true);
    setStatus({ status: 'syncing', message: 'Pulling cloud data…', error: null });

    const { data, error } = await fetchRemote(session.user.id);
    if (error) {
      setHydrating(false);
      setStatus({ status: 'error', message: 'Cloud read failed.', error: error.message });
      return { ok: false, error: error.message };
    }

    if (!data) {
      setHydrating(false);
      setStatus({ status: 'idle', message: 'No cloud data found for this account.', error: null });
      return { ok: false, error: 'No cloud data found.' };
    }

    await applyRemoteState(data, 'Cloud restore complete.');
    setHydrating(false);
    return { ok: true };
  }, [session, applyRemoteState, setStatus]);

  const pushToCloud = useCallback(async () => {
    if (!session?.user?.id) return { ok: false, error: 'Sign in first.' };
    const ok = await pushLocalState('Cloud backup updated.');
    return ok ? { ok: true } : { ok: false, error: 'Cloud backup failed.' };
  }, [session, pushLocalState]);

  return {
    cloudConfigured,
    session,
    userEmail: session?.user?.email || '',
    authReady,
    authBusy,
    hydrating,
    syncInfo,
    signIn,
    signUp,
    signInOAuth,
    signOut,
    syncNow,
    pullFromCloud,
    pushToCloud,
  };
}
