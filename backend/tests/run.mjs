// Runs every behaviour test in this folder, each in its own process (they import the real server and bind ports).
//   node backend/tests/run.mjs
// Needs no credentials and no database: the tests use a fake PostgREST where a route reads the company row.
// Exit code is non-zero if any test file failed.
//
// A file that fails is run ONCE more. If the second run passes it is reported as FLAKY with everything the first run printed, never as a quiet
// pass: on Windows a file has twice reported "1 passed" and nothing else, then passed on every rerun, and the first run's output is the only
// evidence of why. Two failures in a row is a real failure.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();

function runOnce(f) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', env: { ...process.env, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 't' } });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const pass = (out.match(/^PASS/gm) || []).length;
  const bad = (out.match(/^FAIL/gm) || []).length;
  // A Windows-only libuv assertion fires at process.exit() after the work is finished; ignore its exit code
  // and judge by the test's own output instead.
  const ok = bad === 0 && pass > 0 && /all passed|\b\d+ passed, 0 failed/.test(out);
  return { ok, pass, bad, out, status: r.status, signal: r.signal };
}

let failed = 0;
let flaky = 0;
for (const f of files) {
  let r = runOnce(f);
  if (!r.ok) {
    const first = r;
    r = runOnce(f);
    if (r.ok) {
      flaky++;
      console.log(`FLAKY ${f}: failed once, passed on the retry. First attempt (exit ${first.status}${first.signal ? `, signal ${first.signal}` : ''}), last lines of its output:`);
      console.log(first.out.split('\n').slice(-25).map((l) => `    | ${l}`).join('\n'));
    } else {
      failed++;
      console.log(r.out.split('\n').filter((l) => /^FAIL|Error|rror:/.test(l)).join('\n'));
    }
  }
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${f.padEnd(40)} ${r.pass} passed${r.bad ? `, ${r.bad} failed` : ''}`);
}
if (flaky) console.log(`\n${flaky} file(s) were FLAKY (passed only on a retry): see the output above.`);
console.log(failed ? `\n${failed} test file(s) failed` : `\nall ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
