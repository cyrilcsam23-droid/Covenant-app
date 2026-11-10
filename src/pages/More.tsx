import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Cloud, CloudOff, LogOut, Users } from 'lucide-react';
import { actions, APP_NAME, useData, useSync } from '../lib/store';
import { useAuth } from '../lib/auth';
import { isSupabaseConnected } from '../lib/supabase';
import { toCSV } from '../lib/calc';
import { todayISO } from '../lib/format';
import { ShellHeader, Page } from '../components/Layout';
import { Button, ConfirmButton, SectionTitle, TextField, downloadFile } from '../components/ui';

export default function More() {
  const data = useData();
  const sync = useSync();
  const { session, signOut } = useAuth();

  return (
    <>
      <ShellHeader>
        <h1 className="text-[1.35rem] font-semibold">More</h1>
        <p className="mt-1 text-sm text-shell-muted">Business details, partners, data and account.</p>
      </ShellHeader>

      <Page>
        <SectionTitle>Business</SectionTitle>
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <SavedField label="App / business name" value={data.settings.businessName} onSave={(v) => actions.updateSettings({ businessName: v || APP_NAME })} />
          <SavedField
            label="Default vehicle number"
            value={data.settings.defaultVehicle}
            placeholder="KL 07 AB 1234"
            hint="Filled in on every new trip."
            onSave={(v) => actions.updateSettings({ defaultVehicle: v.toUpperCase() })}
          />
        </div>

        <SectionTitle>Partner names</SectionTitle>
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          {data.partners.map((p, i) => (
            <SavedField key={p.id} label={`Partner ${i + 1}`} value={p.name} onSave={(v) => actions.renamePartner(p.id, v || `Partner ${i + 1}`)} />
          ))}
        </div>

        <SectionTitle>Data</SectionTitle>
        <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            {isSupabaseConnected ? <Cloud size={20} className="mt-0.5 text-gain" /> : <CloudOff size={20} className="mt-0.5 text-ink-3" />}
            <div className="text-sm text-ink-2">
              {isSupabaseConnected ? (
                <p>
                  <strong className="font-semibold text-ink">Saved online.</strong> All partners see the same trips and entries; changes reach the other
                  phones within seconds. Without internet, changes are kept on this phone and upload automatically.
                  {sync.pending > 0 && (
                    <strong className="mt-1 block font-semibold text-ink">
                      {sync.pending} {sync.pending === 1 ? 'change is' : 'changes are'} waiting to upload.
                    </strong>
                  )}
                </p>
              ) : (
                <p>
                  <strong className="font-semibold text-ink">Saved on this phone only.</strong> Once Supabase is connected, all three partners will share the
                  same data.
                </p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={data.trips.length === 0}
            onClick={() => downloadFile(`all-trips-${todayISO()}.csv`, toCSV(data.trips))}
          >
            Download all trips (CSV)
          </Button>

          {isSupabaseConnected ? null : data.isSample ? (
            <div>
              <p className="mb-2 text-sm text-ink-2">The app is showing sample trips and partner entries. Clear them to start logging real ones.</p>
              <ConfirmButton onConfirm={() => actions.startFresh()} armedLabel="Tap again to clear sample data">
                Clear sample data
              </ConfirmButton>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-ink-2">Want to see how the app looks with sample trips? This replaces everything on this phone.</p>
              <ConfirmButton onConfirm={() => actions.loadSample()} armedLabel="Tap again: this erases your data">
                Load sample data
              </ConfirmButton>
            </div>
          )}
        </div>

        {sync.isAdmin && (
          <>
            <SectionTitle>Logins</SectionTitle>
            <Link
              to="/more/logins"
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 hover:border-ink-3"
            >
              <span className="flex items-center gap-3">
                <Users size={20} className="text-ink-3" />
                <span>
                  <span className="block font-semibold">Manage logins</span>
                  <span className="block text-sm text-ink-3">Add partners, approve, reset passwords, remove access</span>
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-ink-3" />
            </Link>
          </>
        )}

        <SectionTitle>Account</SectionTitle>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{session?.email}</p>
            <p className="text-sm text-ink-3">{session?.demo ? 'Demo sign-in (Supabase not connected)' : sync.isAdmin ? 'Signed in · Admin' : 'Signed in'}</p>
          </div>
          <Button variant="outline" className="!h-11 shrink-0" onClick={() => void signOut()}>
            <LogOut size={18} /> Sign out
          </Button>
        </div>
        <div className="h-10" />
      </Page>
    </>
  );
}

/** Text input that saves when it loses focus or Enter is pressed. */
function SavedField({
  label,
  value,
  onSave,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  const commit = () => {
    if (v.trim() === value) return;
    onSave(v.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  return (
    <TextField
      label={label}
      value={v}
      placeholder={placeholder}
      hint={saved ? 'Saved' : hint}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
