// Runs every behaviour test in this folder, each in its own process (they import the real server and bind ports).
//   node backend/tests/run.mjs
// Needs no credentials and no database: the tests use a fake PostgREST where a route reads the company row.
// Exit code is non-zero if any test file failed.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', env: { ...process.env, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 't' } });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const pass = (out.match(/^PASS/gm) || []).length;
  const bad = (out.match(/^FAIL/gm) || []).length;
  // A Windows-only libuv assertion fires at process.exit() after the work is finished; ignore its exit code
  // and judge by the test's own output instead.
  const ok = bad === 0 && pass > 0 && /all passed|\b\d+ passed, 0 failed/.test(out);
  if (!ok) { failed++; console.log(out.split('\n').filter((l) => /^FAIL|Error|rror:/.test(l)).join('\n')); }
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${f.padEnd(40)} ${pass} passed${bad ? `, ${bad} failed` : ''}`);
}
console.log(failed ? `\n${failed} test file(s) failed` : `\nall ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
