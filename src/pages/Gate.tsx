import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { actions, APP_NAME, type Sync } from '../lib/store';
import { Plate } from '../components/Plate';
import { Button } from '../components/ui';

/** Full-screen states shown in cloud mode before the app can be used. */
export default function Gate({ sync }: { sync: Sync }) {
  const { session, signOut } = useAuth();

  if (sync.phase === 'not-approved') {
    return (
      <Shell>
        <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">This login isn’t approved yet</h1>
        <p className="mt-3 leading-relaxed text-shell-muted">
          You’re signed in as <strong className="font-semibold text-white">{session?.email}</strong>, but this account hasn’t been added to the
          partners’ list, so no business data is shown. Ask the person who manages the app to approve it.
        </p>
        <Button variant="outline" className="mt-8 w-full !border-shell-line !text-white" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Shell>
    );
  }

  if (sync.phase === 'failed') {
    return (
      <Shell>
        <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">Couldn’t load the data</h1>
        <p className="mt-3 leading-relaxed text-shell-muted">
          {sync.offline ? 'This phone isn’t connected to the internet. Connect and try again.' : sync.message}
        </p>
        <Button className="mt-8 h-14 w-full" onClick={() => actions.retry()}>
          Try again
        </Button>
        <Button variant="ghost" className="mt-3 w-full !text-shell-muted" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mt-6 text-shell-muted" role="status">
        Loading your trips…
      </p>
    </Shell>
  );
}

/** Opened from a password-reset email: choose a new password before using the app. */
export function SetNewPassword() {
  const { session, setNewPassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== repeat) return setError('The two passwords don’t match.');
    setBusy(true);
    setError(await setNewPassword(password));
    setBusy(false);
  };

  return (
    <Shell>
      <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">Choose a new password</h1>
      <p className="mt-2 text-shell-muted">
        For <strong className="font-semibold text-white">{session?.email}</strong>. Use at least 8 characters.
      </p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-shell-muted">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="field-input field-input-dark"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="repeat-password" className="mb-1.5 block text-sm font-medium text-shell-muted">
            Type it again
          </label>
          <input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            className="field-input field-input-dark"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-lg bg-loss/15 px-3 py-2 text-sm font-medium text-[#ffb4ab]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="h-14 w-full text-[1.05rem]">
          {busy ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
      <Button variant="ghost" className="mt-3 w-full !text-shell-muted" onClick={() => void signOut()}>
        Cancel and sign out
      </Button>
    </Shell>
  );
}

/** Published build with no Supabase settings: refuse to run rather than fall back to demo mode. */
export function NotConfigured() {
  return (
    <Shell>
      <h1 className="mt-6 text-[1.6rem] font-semibold leading-tight">The app isn’t set up yet</h1>
      <p className="mt-3 leading-relaxed text-shell-muted">
        This version was published without its database settings, so it can’t be used. Ask the person who manages the app to publish it again.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="on-shell flex min-h-dvh flex-col bg-shell px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)] text-white">
      <div className="mx-auto w-full max-w-sm">
        <Plate size="lg" className="!text-[clamp(2rem,10vw,2.75rem)] uppercase tracking-[0.04em]">
          {APP_NAME}
        </Plate>
        {children}
      </div>
    </main>
  );
}
