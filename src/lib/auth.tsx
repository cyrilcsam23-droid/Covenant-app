import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

interface Session {
  email: string;
  demo: boolean;
}

interface AuthValue {
  session: Session | null;
  loading: boolean;
  /** Signed in through a password-reset link: the app asks for a new password first. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Emails a reset link. Resolves to an error message, or null. */
  sendResetLink: (email: string) => Promise<string | null>;
  /** Sets the signed-in user's new password. Resolves to an error message, or null. */
  setNewPassword: (password: string) => Promise<string | null>;
}

const DEMO_KEY = 'dropship:demo-session';
const AuthContext = createContext<AuthValue | null>(null);

// Read before Supabase tidies the address bar: a reset link arrives as #...type=recovery.
const openedFromResetLink = typeof window !== 'undefined' && /(^|[#&?])type=recovery(&|$)/.test(window.location.hash + window.location.search);

/** Where reset links send people back to: this app's own address. */
const appHome = () => window.location.origin + import.meta.env.BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(openedFromResetLink && supabase !== null);

  useEffect(() => {
    if (!supabase) {
      try {
        const email = localStorage.getItem(DEMO_KEY);
        if (email) setSession({ email, demo: true });
      } catch {
        /* storage unavailable */
      }
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user.email;
      setSession(email ? { email, demo: false } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      const email = s?.user.email;
      setSession(email ? { email, demo: false } : null);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? error.message : null;
    }
    // Demo mode (local development only): no real check.
    const name = email.trim() || 'demo@local';
    try {
      localStorage.setItem(DEMO_KEY, name);
    } catch {
      /* ignore */
    }
    setSession({ email: name, demo: true });
    return null;
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
    setRecovering(false);
  };

  const sendResetLink = async (email: string) => {
    if (!supabase) return 'Password reset needs the online database.';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appHome() });
    // Don't reveal whether an email has a login; only report real failures (e.g. too many requests).
    return error && !/not found|no user/i.test(error.message) ? error.message : null;
  };

  const setNewPassword = async (password: string) => {
    if (!supabase) return 'Password reset needs the online database.';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return error.message;
    setRecovering(false);
    return null;
  };

  return (
    <AuthContext.Provider value={{ session, loading, recovering, signIn, signOut, sendResetLink, setNewPassword }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
