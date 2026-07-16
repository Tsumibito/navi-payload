#!/usr/bin/env tsx
/**
 * Self-check for seed-pages.ts production guard.
 * Tests: prod without flag, prod with "no", non-prod allowed, missing root .env, missing --env-file.
 * Does NOT connect to any database — only tests guard logic via subprocess.
 *
 * Run: npx tsx scripts/test-seed-guard.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SEED_SCRIPT = path.join(SCRIPT_DIR, 'seed-pages.ts');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-guard-'));
const PROD_URI = 'postgresql://user:pass@prod-host.example.com:5432/navi';
const BRANCH_URI = 'postgresql://user:pass@branch-host.example.com:5432/navi';

function writeEnv(filePath: string, vars: Record<string, string>): void {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', { mode: 0o600 });
}

interface Result {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function run(args: string[], opts: { stdin?: string; testRoot?: string } = {}): Result {
  try {
    const stdout = execSync(
      `npx tsx "${SEED_SCRIPT}" ${args.map(a => `"${a}"`).join(' ')}`,
      {
        input: opts.stdin || '',
        encoding: 'utf-8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SEED_GUARD_TEST_ROOT: opts.testRoot || TMP,
          // Clear DATABASE_URI so Payload doesn't pick up real env
          DATABASE_URI: '',
          PAYLOAD_SECRET: '',
        },
      }
    );
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: any) {
    return {
      exitCode: err.status ?? -1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

let passed = 0;
let failed = 0;

function check(name: string, result: Result, expect: {
  exitCode: number;
  stderrContains?: string;
  stdoutContains?: string;
}): void {
  const issues: string[] = [];
  if (result.exitCode !== expect.exitCode) {
    issues.push(`exit ${result.exitCode} ≠ ${expect.exitCode}`);
  }
  if (expect.stderrContains && !result.stderr.includes(expect.stderrContains)) {
    issues.push(`stderr missing "${expect.stderrContains}"`);
  }
  if (expect.stdoutContains && !result.stdout.includes(expect.stdoutContains)) {
    issues.push(`stdout missing "${expect.stdoutContains}"`);
  }
  if (issues.length === 0) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name} — ${issues.join('; ')}`);
    if (result.stderr) console.log(`    stderr: ${result.stderr.slice(0, 300)}`);
    failed++;
  }
}

// Setup: root .env with production URI
writeEnv(path.join(TMP, '.env'), { DATABASE_URI: PROD_URI });

// Test 1: prod without --allow-production → REFUSED
{
  const envFile = path.join(TMP, '.env.prod');
  writeEnv(envFile, { DATABASE_URI: PROD_URI, PAYLOAD_SECRET: 'test' });
  check('prod without flag → REFUSED', run(['--env-file', envFile]), {
    exitCode: 1,
    stderrContains: 'REFUSED: target endpoint matches production',
  });
}

// Test 2: prod with --allow-production, answer "no" → Aborted
{
  const envFile = path.join(TMP, '.env.prod2');
  writeEnv(envFile, { DATABASE_URI: PROD_URI, PAYLOAD_SECRET: 'test' });
  check('prod with --allow-production, answer "no" → Aborted', run(['--env-file', envFile, '--allow-production'], { stdin: 'no\n' }), {
    exitCode: 1,
    stderrContains: 'Aborted',
  });
}

// Test 3: non-prod endpoint → guard passes (fails later on DB connection)
{
  const envFile = path.join(TMP, '.env.branch');
  writeEnv(envFile, { DATABASE_URI: BRANCH_URI, PAYLOAD_SECRET: 'test' });
  const result = run(['--env-file', envFile]);
  // Guard should NOT refuse — any error is a DB connection error, not a guard refusal
  const guardRefused = result.stderr.includes('REFUSED');
  if (guardRefused) {
    console.log(`  FAIL: non-prod endpoint → guard should pass — but REFUSED`);
    failed++;
  } else {
    console.log(`  PASS: non-prod endpoint → guard passed (script failed on DB connect as expected)`);
    passed++;
  }
}

// Test 4: missing root .env → fail-closed
{
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-no-root-'));
  const envFile = path.join(TMP, '.env.prod3');
  writeEnv(envFile, { DATABASE_URI: PROD_URI, PAYLOAD_SECRET: 'test' });
  check('missing root .env → fail-closed', run(['--env-file', envFile], { testRoot: emptyRoot }), {
    exitCode: 1,
    stderrContains: 'production reference .env not found',
  });
  fs.rmSync(emptyRoot, { recursive: true, force: true });
}

// Test 5: missing --env-file → usage error
{
  check('missing --env-file → usage error', run([]), {
    exitCode: 1,
    stderrContains: '--env-file is required',
  });
}

// Test 6: root .env without DATABASE_URI → fail-closed
{
  const noUriRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-no-uri-'));
  writeEnv(path.join(noUriRoot, '.env'), { SOME_OTHER_VAR: 'x' });
  const envFile = path.join(TMP, '.env.prod5');
  writeEnv(envFile, { DATABASE_URI: PROD_URI, PAYLOAD_SECRET: 'test' });
  check('root .env without DATABASE_URI → fail-closed', run(['--env-file', envFile], { testRoot: noUriRoot }), {
    exitCode: 1,
    stderrContains: 'root .env has no DATABASE_URI',
  });
  fs.rmSync(noUriRoot, { recursive: true, force: true });
}

// Test 7: arbitrary cwd — run from /tmp, root still resolves via SEED_GUARD_TEST_ROOT
{
  const envFile = path.join(TMP, '.env.prod4');
  writeEnv(envFile, { DATABASE_URI: PROD_URI, PAYLOAD_SECRET: 'test' });
  const result = execSync(
    `cd /tmp && SEED_GUARD_TEST_ROOT="${TMP}" DATABASE_URI="" PAYLOAD_SECRET="" npx tsx "${SEED_SCRIPT}" --env-file "${envFile}" 2>&1 || true`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  if (result.includes('REFUSED: target endpoint matches production')) {
    console.log(`  PASS: arbitrary cwd → guard still works`);
    passed++;
  } else {
    console.log(`  FAIL: arbitrary cwd → guard did not refuse prod endpoint`);
    failed++;
  }
}

// Cleanup
fs.rmSync(TMP, { recursive: true, force: true });

console.log(`\nGuard tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
