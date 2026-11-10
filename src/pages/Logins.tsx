import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { adminApi, suggestPassword, type LoginInfo, type Role } from '../lib/admin';
import { useSync } from '../lib/store';
import { fmtDate } from '../lib/format';
import { Page } from '../components/Layout';
import { Button, ConfirmButton, Empty, FormBar, Segmented, SectionTitle, TextField } from '../components/ui';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'partner', label: 'Partner' },
  { value: 'admin', label: 'Admin' },
];

/** Admins only: who can sign in, add logins, approve, reset passwords, remove access. */
export default function Logins() {
  const sync = useSync();
  const [users, setUsers] = useState<LoginInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setUsers(await adminApi.list());
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (sync.isAdmin) void load();
  }, [sync.isAdmin, load]);

  if (sync.mode !== 'cloud' || !sync.isAdmin) return <Navigate to="/more" replace />;

  const done = (msg: string) => {
    setNotice(msg);
    void load();
  };

  return (
    <>
      <FormBar title="Logins" backTo="/more" />
      <Page>
        <p className="mt-5 text-sm leading-relaxed text-ink-2">
          Everyone who can sign in to the app. Only approved logins see the business data. Give each partner their own login, and share the
          password with them privately.
        </p>

        {notice && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#e7f1ea] px-3.5 py-3 text-sm font-medium text-gain" role="status">
            <ShieldCheck size={18} className="mt-px shrink-0" /> {notice}
          </p>
        )}

        <SectionTitle
          action={
            <button type="button" onClick={() => void load()} className="flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink">
              <RefreshCw size={15} /> Refresh
            </button>
          }
        >
          People with a login
        </SectionTitle>
        {loadError ? (
          <Empty title="Couldn’t load the logins">{loadError}</Empty>
        ) : users === null ? (
          <p className="text-sm text-ink-3" role="status">
            Loading…
          </p>
        ) : users.length === 0 ? (
          <Empty title="No logins yet" />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {users.map((u) => (
              <LoginRow key={u.id} user={u} onDone={done} />
            ))}
          </ul>
        )}

        <AddLogin onDone={done} />
        <div className="h-10" />
      </Page>
    </>
  );
}

function statusOf(u: LoginInfo): { label: string; tone: string } {
  if (u.removed) return { label: 'Access removed', tone: 'bg-loss-soft text-loss' };
  if (u.role === 'admin') return { label: 'Admin', tone: 'bg-plate text-plate-ink' };
  if (u.role === 'partner') return { label: 'Partner', tone: 'bg-[#e4e4de] text-ink' };
  return { label: 'Not approved', tone: 'bg-[#fdf1cc] text-[#7a5a00]' };
}

function LoginRow({ user, onDone }: { user: LoginInfo; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const status = statusOf(user);
  const approved = !!user.role && !user.removed;

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      setPassword('');
      onDone(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-black/[0.02]"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {user.email}
            {user.isYou && <span className="ml-1.5 font-normal text-ink-3">(you)</span>}
          </span>
          <span className="block text-sm text-ink-3">
            {user.lastSignInAt ? `Last signed in ${fmtDate(user.lastSignInAt.slice(0, 10))}` : 'Never signed in'}
          </span>
        </span>
        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line bg-ground/60 px-4 py-4">
          {!approved && (
            <Button className="w-full" disabled={busy} onClick={() => void run(() => adminApi.approve(user.id), `${user.email} can now sign in and see the data.`)}>
              <ShieldCheck size={18} /> {user.removed ? 'Give access again' : 'Approve as partner'}
            </Button>
          )}

          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => adminApi.setPassword(user.id, password), `New password set for ${user.email}. Share it with them privately.`);
            }}
          >
            <TextField
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              hint={
                <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setPassword(suggestPassword())}>
                  Suggest a strong password
                </button>
              }
            />
            <Button type="submit" variant="outline" className="w-full" disabled={busy || password.length < 8}>
              <KeyRound size={18} /> Set new password
            </Button>
          </form>

          {approved && !user.isYou && (
            <ConfirmButton
              onConfirm={() => void run(() => adminApi.remove(user.id), `${user.email} can no longer sign in or see the data.`)}
              armedLabel="Tap again to remove access"
            >
              Remove access
            </ConfirmButton>
          )}

          {error && (
            <p className="text-sm font-medium text-loss" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function AddLogin({ onDone }: { onDone: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('partner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('The password needs at least 8 characters.');
    setBusy(true);
    setError(null);
    try {
      await adminApi.create(clean, password, role);
      setEmail('');
      setPassword('');
      setRole('partner');
      onDone(`Login created for ${clean}. Share the email and password with them privately.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Add a login</SectionTitle>
      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <TextField label="Email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" />
        <TextField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          hint={
            <span>
              At least 8 characters.{' '}
              <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setPassword(suggestPassword())}>
                Suggest a strong password
              </button>
            </span>
          }
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Access</p>
          <Segmented name="login-role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
          <p className="mt-1.5 text-sm text-ink-3">
            {role === 'admin' ? 'Can see the data and also manage logins.' : 'Can log trips and see all the data.'}
          </p>
        </div>
        {error && (
          <p className="text-sm font-medium text-loss" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          <UserPlus size={18} /> {busy ? 'Creating…' : 'Create login'}
        </Button>
      </form>
    </>
  );
}
