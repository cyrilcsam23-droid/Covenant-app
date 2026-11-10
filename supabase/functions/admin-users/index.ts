// Covenant: manage partner logins from the app.
//
// Runs on Supabase (Edge Function), where the service-role key is available as an
// environment variable. That key never reaches the app or the browser.
//
// Every request must carry the caller's own sign-in token, and the caller must be an
// approved member with role 'admin' (public.app_members). Everyone else gets 401/403.
//
// Actions (POST JSON { action, ... }):
//   list                                 -> all logins with their status
//   create   { email, password, role }   -> new login, approved straight away
//   approve  { userId }                  -> approve a login made in the dashboard (as partner)
//   remove   { userId }                  -> take away access (kept for the record, signed out)
//   password { userId, password }        -> set a new password
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const ALLOWED_ORIGINS = new Set(['https://cyrilcsam23-droid.github.io', 'http://localhost:5180']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const ROLES = new Set(['admin', 'partner']);
const BAN_FOREVER = '876000h'; // 100 years

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://cyrilcsam23-droid.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function checkPassword(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < 8) return 'The password needs at least 8 characters.';
  if (p.length > 72) return 'The password can be at most 72 characters.';
  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return reply(500, { error: 'The server is not configured.' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Who is calling? Checked with the auth server, not just decoded.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return reply(401, { error: 'Please sign in again.' });
  const { data: who, error: whoError } = await admin.auth.getUser(token);
  if (whoError || !who?.user) return reply(401, { error: 'Please sign in again.' });
  const me = who.user;

  // 2. Only approved admins.
  const { data: myMembership, error: memberError } = await admin.from('app_members').select('role').eq('user_id', me.id).maybeSingle();
  if (memberError) return reply(500, { error: 'Could not check your access. Try again.' });
  if (myMembership?.role !== 'admin') return reply(403, { error: 'Only an admin can manage logins.' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Bad request.' });
  }
  const action = body?.action;
  const userId = typeof body?.userId === 'string' ? body.userId : '';

  try {
    switch (action) {
      case 'list': {
        const [{ data: page, error }, { data: members, error: mErr }] = await Promise.all([
          admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
          admin.from('app_members').select('user_id, role'),
        ]);
        if (error || mErr) throw error ?? mErr;
        const roles = new Map((members ?? []).map((m) => [m.user_id as string, m.role as string]));
        const now = Date.now();
        const users = page.users
          .map((u) => ({
            id: u.id,
            email: u.email ?? '',
            role: roles.get(u.id) ?? null,
            removed: !!u.banned_until && new Date(u.banned_until).getTime() > now,
            lastSignInAt: u.last_sign_in_at ?? null,
            createdAt: u.created_at,
            isYou: u.id === me.id,
          }))
          .sort((a, b) => a.email.localeCompare(b.email));
        return reply(200, { users });
      }

      case 'create': {
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const role = typeof body.role === 'string' ? body.role : 'partner';
        if (!EMAIL.test(email) || email.length > 254) return reply(400, { error: 'Enter a valid email address.' });
        if (!ROLES.has(role)) return reply(400, { error: 'Unknown role.' });
        const bad = checkPassword(body.password);
        if (bad) return reply(400, { error: bad });

        const { data, error } = await admin.auth.admin.createUser({ email, password: body.password as string, email_confirm: true });
        if (error || !data.user) {
          const msg = error?.message ?? '';
          if (/already|registered|exists/i.test(msg)) return reply(409, { error: 'This email already has a login.' });
          if (/password/i.test(msg)) return reply(400, { error: msg });
          throw error;
        }
        const { error: insertError } = await admin.from('app_members').insert({ user_id: data.user.id, role });
        if (insertError) {
          await admin.auth.admin.deleteUser(data.user.id); // don't leave a half-made login behind
          throw insertError;
        }
        return reply(200, { ok: true });
      }

      case 'approve': {
        if (!UUID.test(userId)) return reply(400, { error: 'Bad request.' });
        const { error: upErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
        if (upErr) throw upErr;
        const { error } = await admin.from('app_members').upsert({ user_id: userId, role: 'partner' }, { onConflict: 'user_id', ignoreDuplicates: true });
        if (error) throw error;
        return reply(200, { ok: true });
      }

      case 'remove': {
        if (!UUID.test(userId)) return reply(400, { error: 'Bad request.' });
        if (userId === me.id) return reply(400, { error: 'You can’t remove your own access.' });
        const { data: target } = await admin.from('app_members').select('role').eq('user_id', userId).maybeSingle();
        if (target?.role === 'admin') {
          const { count } = await admin.from('app_members').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
          if ((count ?? 0) <= 1) return reply(400, { error: 'There must always be at least one admin.' });
        }
        // Access ends at once (data rules check app_members); the ban stops new sign-ins.
        // The login itself is kept so the record of who entered what stays intact.
        const { error } = await admin.from('app_members').delete().eq('user_id', userId);
        if (error) throw error;
        const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
        if (banErr) throw banErr;
        return reply(200, { ok: true });
      }

      case 'password': {
        if (!UUID.test(userId)) return reply(400, { error: 'Bad request.' });
        const bad = checkPassword(body.password);
        if (bad) return reply(400, { error: bad });
        const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password as string });
        if (error) return reply(400, { error: error.message });
        return reply(200, { ok: true });
      }

      default:
        return reply(400, { error: 'Unknown action.' });
    }
  } catch (e) {
    console.error('admin-users', action, e);
    return reply(500, { error: 'Something went wrong. Try again.' });
  }
});
