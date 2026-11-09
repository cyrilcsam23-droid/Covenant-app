import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

interface Session {
  email: string;
  demo: boolean;
}

interface AuthValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const DEMO_KEY = 'dropship:demo-session';
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const email = s?.user.email;
      setSession(email ? { email, demo: false } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    }
    // Demo mode: no real check until Supabase is connected.
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
  };

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
