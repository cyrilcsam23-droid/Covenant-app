/**
 * Login management (admins only). Calls the `admin-users` Edge Function, which checks
 * on the server that the caller is an approved admin before doing anything.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Role = 'admin' | 'partner';

export interface LoginInfo {
  id: string;
  email: string;
  /** null = has a login but isn't approved. */
  role: Role | null;
  removed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  isYou: boolean;
}

type Request =
  | { action: 'list' }
  | { action: 'create'; email: string; password: string; role: Role }
  | { action: 'approve'; userId: string }
  | { action: 'remove'; userId: string }
  | { action: 'password'; userId: string; password: string };

async function call<T>(body: Request): Promise<T> {
  if (!supabase) throw new Error('Supabase isn’t connected.');
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? 'Something went wrong. Try again.');
    }
    throw new Error('Couldn’t reach the server. Check the internet connection.');
  }
  return data as T;
}

export const adminApi = {
  list: () => call<{ users: LoginInfo[] }>({ action: 'list' }).then((r) => r.users),
  create: (email: string, password: string, role: Role) => call({ action: 'create', email, password, role }),
  approve: (userId: string) => call({ action: 'approve', userId }),
  remove: (userId: string) => call({ action: 'remove', userId }),
  setPassword: (userId: string, password: string) => call({ action: 'password', userId, password }),
};

/** A strong, easy-to-read password (no look-alike characters), e.g. "Kumarakom-7Hb4-Ravi". */
export function suggestPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = (n: number) => {
    const b = new Uint32Array(n);
    crypto.getRandomValues(b);
    return [...b].map((x) => chars[x % chars.length]).join('');
  };
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}
