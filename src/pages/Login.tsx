import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { isSupabaseConnected } from '../lib/supabase';
import { useData } from '../lib/store';
import { Plate } from '../components/Plate';
import { Button } from '../components/ui';

export default function Login() {
  const { signIn, sendResetLink } = useAuth();
  const { settings } = useData();
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
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

  const requestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Enter the email you sign in with.');
      return;
    }
    setBusy(true);
    const err = await sendResetLink(email);
    setBusy(false);
    setError(err);
    setSent(!err);
  };

  const switchMode = (m: 'signin' | 'reset') => {
    setMode(m);
    setError(null);
    setSent(false);
  };

  return (
    <main className="on-shell flex min-h-dvh flex-col bg-shell px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)] text-white">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <Plate size="lg" className="self-start !text-[clamp(2rem,10vw,2.75rem)] uppercase tracking-[0.04em]">
          {settings.businessName}
        </Plate>

        {mode === 'signin' ? (
          <>
            <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">Sign in to log trips</h1>
            <p className="mt-2 text-shell-muted">Daily trips, expenses and partner money in one place.</p>

            <form onSubmit={submit} noValidate className="mt-8 space-y-4">
              <EmailInput value={email} onChange={setEmail} />
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
              {error && <ErrorText>{error}</ErrorText>}
              <Button type="submit" disabled={busy} className="h-14 w-full text-[1.05rem]">
                {busy ? 'Signing in…' : isSupabaseConnected ? 'Sign in' : 'Continue in demo mode'}
              </Button>
            </form>
            {isSupabaseConnected && (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="mt-4 self-start py-2 text-sm font-medium text-white underline underline-offset-4 hover:text-plate"
              >
                Forgot password?
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">Reset your password</h1>
            <p className="mt-2 text-shell-muted">We’ll email you a link. Open it on this phone to choose a new password.</p>

            {sent ? (
              <div className="mt-8 rounded-xl bg-shell-2 p-4 text-sm leading-relaxed text-shell-muted" role="status">
                <p className="font-semibold text-white">Check your email</p>
                <p className="mt-1">
                  If <strong className="font-semibold text-white">{email.trim()}</strong> has a login, a reset link is on its way. It can take a few
                  minutes; check the spam folder too.
                </p>
                <p className="mt-2">No email? Ask the admin to set a new password for you in More → Manage logins.</p>
              </div>
            ) : (
              <form onSubmit={requestReset} noValidate className="mt-8 space-y-4">
                <EmailInput value={email} onChange={setEmail} />
                {error && <ErrorText>{error}</ErrorText>}
                <Button type="submit" disabled={busy} className="h-14 w-full text-[1.05rem]">
                  {busy ? 'Sending…' : 'Email me a reset link'}
                </Button>
              </form>
            )}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="mt-4 self-start py-2 text-sm font-medium text-white underline underline-offset-4 hover:text-plate"
            >
              Back to sign in
            </button>
          </>
        )}

        <p className="mt-auto pt-10 text-sm leading-relaxed text-shell-muted">
          {isSupabaseConnected
            ? 'Only partner accounts can sign in. Ask the person who manages the app if you need a login.'
            : 'Demo mode: Supabase isn’t connected yet, so any email works and data stays on this phone.'}
        </p>
      </div>
    </main>
  );
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
      />
    </div>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <p className="rounded-lg bg-loss/15 px-3 py-2 text-sm font-medium text-[#ffb4ab]" role="alert">
      {children}
    </p>
  );
}
