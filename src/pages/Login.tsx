import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { isSupabaseConnected } from '../lib/supabase';
import { useData } from '../lib/store';
import { Plate } from '../components/Plate';
import { Button } from '../components/ui';

export default function Login() {
  const { signIn } = useAuth();
  const { settings } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSupabaseConnected && (!email.trim() || !password)) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <main className="on-shell flex min-h-dvh flex-col bg-shell px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)] text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Plate size="lg" className="self-start !text-[clamp(2rem,10vw,2.75rem)] uppercase tracking-[0.04em]">
          {settings.businessName}
        </Plate>
        <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">Sign in to log trips</h1>
        <p className="mt-2 text-shell-muted">Daily trips, expenses and partner money in one place.</p>

        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-shell-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="field-input field-input-dark"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-shell-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="field-input field-input-dark"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-loss/15 px-3 py-2 text-sm font-medium text-[#ffb4ab]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="h-14 w-full text-[1.05rem]">
            {busy ? 'Signing in…' : isSupabaseConnected ? 'Sign in' : 'Continue in demo mode'}
          </Button>
        </form>

        <p className="mt-auto pt-10 text-sm leading-relaxed text-shell-muted">
          {isSupabaseConnected
            ? 'Accounts are created by the admin in Supabase. Ask them if you can’t sign in.'
            : 'Demo mode: Supabase isn’t connected yet, so any email works and data stays on this phone.'}
        </p>
      </div>
    </main>
  );
}
