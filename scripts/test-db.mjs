// Runs supabase/tests/*.sql against the live Supabase project and prints PASS / FAIL.
// Every test rolls itself back, so nothing is left in the database.
// Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (or the default below) in .env.local.
// Usage: npm run test:db
import { readFileSync, readdirSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
// Read from the file on purpose: a stale token in the system environment must not win.
const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF || 'gsrjwxpbxrhngbkviend';
if (!token) {
  console.error('No SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(2);
}

const dir = new URL('../supabase/tests/', import.meta.url);
let failed = 0;
let passed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: readFileSync(new URL(file, dir), 'utf8') }),
  });
  const body = await res.text();
  const marker = body.indexOf('RESULTS:');
  console.log(`\n${file}`);
  if (marker < 0) {
    console.log(`  could not run (HTTP ${res.status}): ${body.slice(0, 400)}`);
    failed++;
    continue;
  }
  const lines = body
    .slice(marker + 8)
    .split(/\\n|\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('PASS') || l.startsWith('FAIL'));
  for (const l of lines) {
    console.log('  ' + l);
    if (l.startsWith('FAIL')) failed++;
    else passed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
