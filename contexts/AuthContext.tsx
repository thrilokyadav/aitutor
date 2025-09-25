import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from '../services/supabaseClient';

interface AuthContextValue {
  user: { id: string; email?: string | null } | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Surface OAuth error parameters if present in URL (query or hash)
    try {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const combined = `${search}${hash}`;
      if (combined.includes('error=')) {
        const params = new URLSearchParams(combined.replace(/^#/, '').replace(/^\?/, ''));
        const err = params.get('error');
        const errCode = params.get('error_code') || params.get('code');
        const errDesc = params.get('error_description') || params.get('description');
        // Log details for debugging
        // eslint-disable-next-line no-console
        console.error('[Auth] OAuth callback error', { err, errCode, errDesc, combined });
        // Show minimal alert so the user knows why sign-in failed
        if (errDesc) {
          alert(`Sign-in failed: ${decodeURIComponent(errDesc)}`);
        } else if (err || errCode) {
          alert(`Sign-in failed: ${err || ''} ${errCode || ''}`.trim());
        }
        // Clean URL to avoid repeating the alert on refresh
        try {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch {}
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[Auth] Failed to parse OAuth error params', e);
    }

    if (!SUPABASE_ENABLED) {
      setUser(null);
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[Auth] getSession error', error);
        }
        const sessionUser = data.session?.user ?? null;
        // eslint-disable-next-line no-console
        console.log('[Auth] init session user', sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
        setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[Auth] init getSession threw', e);
      } finally {
        setLoading(false);
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // eslint-disable-next-line no-console
      console.log('[Auth] onAuthStateChange', { event, user: session?.user ? { id: session.user.id, email: session.user.email } : null });
      const sessionUser = session?.user ?? null;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email } : null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!SUPABASE_ENABLED) {
      alert('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and reload.');
      return;
    }
    try {
      const redirectTo = window.location.origin; // Vite dev: http://localhost:5173
      // eslint-disable-next-line no-console
      console.log('[Auth] signInWithGoogle redirectTo', redirectTo);
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[Auth] signInWithOAuth error', error);
        alert(`Sign-in error: ${error.message}`);
      } else {
        // eslint-disable-next-line no-console
        console.log('[Auth] signInWithOAuth initiated', data);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[Auth] signInWithGoogle threw', e);
      alert(`Sign-in error: ${e?.message || e}`);
    }
  };

  const signOut = async () => {
    if (!SUPABASE_ENABLED) {
      setUser(null);
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Auth] signOut threw', e);
    }
  };

  const value = useMemo<AuthContextValue>(() => ({ user, loading, signInWithGoogle, signOut }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
