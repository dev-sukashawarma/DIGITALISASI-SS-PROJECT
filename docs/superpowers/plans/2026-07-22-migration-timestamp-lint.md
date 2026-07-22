# Migration Timestamp Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CI guard that rejects new `supabase/migrations/*.sql` files with an unreasonable timestamp (e.g. a far-future year like 2030), so a migration can never again silently "run last forever" and overwrite a later fix — the exact failure mode behind the 2026-07-21 `ledger_stamp_saldo` incident.

**Architecture:** One pure function (`checkTimestamp`) validates a single filename's 14-digit timestamp against a `[-30, +2]` day window around "now". A thin aggregator (`lintFiles`) runs it over a list of files and collects every violation. A CLI entrypoint in the same file wires `lintFiles` to `process.argv`/`process.exit`. A new independent GitHub Actions job diffs the push/PR to find newly-added migration files and runs the CLI against them.

**Tech Stack:** Plain Node.js ESM (`.mjs`), Node's built-in `node:test` + `node:assert/strict` test runner (no new npm dependency), GitHub Actions (existing `.github/workflows/ci.yml`).

## Global Constraints

- Only newly **added** files under `supabase/migrations/` are checked — never the whole directory (the 9 existing `2030*` files must NOT be touched or made to fail CI).
- Valid window: timestamp must be within **-30 days to +2 days** of "now" (UTC) to pass.
- Filenames that don't match the 14-digit-prefix pattern (`^\d{14}_.+\.sql$`) are skipped (`ok: true`), never fail the lint.
- No new npm dependencies. No husky/git-hook infrastructure — CI only.
- All source in `scripts/migration-timestamp-lint.mjs`, tests in `scripts/migration-timestamp-lint.test.mjs`.

---

### Task 1: Core validation function `checkTimestamp`

**Files:**
- Create: `scripts/migration-timestamp-lint.mjs`
- Test: `scripts/migration-timestamp-lint.test.mjs`

**Interfaces:**
- Produces: `export function checkTimestamp(filename: string, now?: Date): { ok: boolean, reason?: string }`. `filename` must be a **bare filename** (no path separators). `now` defaults to `new Date()` but callers in later tasks always pass it explicitly to keep tests deterministic.

- [ ] **Step 1: Write the failing tests**

Create `scripts/migration-timestamp-lint.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTimestamp } from './migration-timestamp-lint.mjs';

const NOW = new Date('2026-07-22T12:00:00Z');

test('file dengan timestamp hari ini lolos', () => {
  const result = checkTimestamp('20260722100000_add_something.sql', NOW);
  assert.equal(result.ok, true);
});

test('file dengan timestamp tahun 2030 gagal', () => {
  const result = checkTimestamp('20300103000008_foo.sql', NOW);
  assert.equal(result.ok, false);
  assert.match(result.reason, /2030-01-03/);
  assert.match(result.reason, /jangan lompat tahun/);
});

test('filename tidak cocok pola 14-digit dilewati', () => {
  const result = checkTimestamp('README.sql', NOW);
  assert.equal(result.ok, true);
});

test('komponen tanggal tidak valid (bulan 13) gagal', () => {
  const result = checkTimestamp('20261322000000_bad_month.sql', NOW);
  assert.equal(result.ok, false);
  assert.match(result.reason, /format tanggal tidak valid/);
});

test('batas jendela: -30 hari tepat lolos, -31 hari gagal', () => {
  const okBoundary = checkTimestamp('20260622120000_thirty_days_ago.sql', NOW);
  assert.equal(okBoundary.ok, true);

  const failBoundary = checkTimestamp('20260621120000_thirtyone_days_ago.sql', NOW);
  assert.equal(failBoundary.ok, false);
});

test('batas jendela: +2 hari tepat lolos, +3 hari gagal', () => {
  const okBoundary = checkTimestamp('20260724120000_two_days_ahead.sql', NOW);
  assert.equal(okBoundary.ok, true);

  const failBoundary = checkTimestamp('20260725120000_three_days_ahead.sql', NOW);
  assert.equal(failBoundary.ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/migration-timestamp-lint.test.mjs`
Expected: FAIL — `Cannot find module './migration-timestamp-lint.mjs'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/migration-timestamp-lint.mjs`:

```js
#!/usr/bin/env node
// Cek migration timestamp tak wajar (cegah ranjau seperti insiden 2026-07-21,
// lihat docs/superpowers/specs/2026-07-22-migration-timestamp-lint-design.md).

const FILENAME_PATTERN = /^(\d{14})_.+\.sql$/;
const PAST_WINDOW_DAYS = 30;
const FUTURE_WINDOW_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTimestamp(digits) {
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  const second = Number(digits.slice(12, 14));

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // Date.UTC menormalisasi tanggal tak valid (mis. 31 Feb -> 3 Mar) — tolak kalau berubah.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function checkTimestamp(filename, now = new Date()) {
  const match = FILENAME_PATTERN.exec(filename);
  if (!match) {
    return { ok: true };
  }

  const date = parseTimestamp(match[1]);
  if (!date) {
    return {
      ok: false,
      reason: `${filename} — format tanggal tidak valid di timestamp "${match[1]}".`,
    };
  }

  const diffDays = (date.getTime() - now.getTime()) / MS_PER_DAY;

  if (diffDays > FUTURE_WINDOW_DAYS) {
    const daysAhead = Math.round(diffDays);
    return {
      ok: false,
      reason:
        `${filename} — timestamp ${date.toISOString().slice(0, 10)} (~${daysAhead} hari ke depan).\n` +
        `  Migration bertimestamp jauh ke depan akan SELALU jalan paling akhir & bisa\n` +
        `  menimpa balik fix lain diam-diam (lihat insiden 2026-07-21, ledger_stamp_saldo).\n` +
        `  Kalau ini collision timestamp asli, geser DETIK di tanggal HARI INI — jangan lompat tahun.`,
    };
  }

  if (diffDays < -PAST_WINDOW_DAYS) {
    const daysBehind = Math.round(-diffDays);
    return {
      ok: false,
      reason: `${filename} — timestamp ${date.toISOString().slice(0, 10)} (~${daysBehind} hari di masa lalu, di luar jendela ${PAST_WINDOW_DAYS} hari).`,
    };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/migration-timestamp-lint.test.mjs`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/migration-timestamp-lint.mjs scripts/migration-timestamp-lint.test.mjs
git commit -m "feat: add checkTimestamp pure function for migration lint"
```

---

### Task 2: Multi-file aggregator (`lintFiles`) + CLI entrypoint

**Files:**
- Modify: `scripts/migration-timestamp-lint.mjs` (append `lintFiles` export + CLI block)
- Modify: `scripts/migration-timestamp-lint.test.mjs` (append tests)

**Interfaces:**
- Consumes: `checkTimestamp(filename, now)` from Task 1 (exact signature above).
- Produces: `export function lintFiles(filenames: string[], now?: Date): { ok: boolean, violations: string[] }`. Strips any path prefix from each entry before calling `checkTimestamp` (so callers can pass full paths like `supabase/migrations/xyz.sql`). CLI: `node scripts/migration-timestamp-lint.mjs <file1> <file2> ...` — exit 0 if clean or no args, exit 1 and prints every violation to stderr otherwise.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/migration-timestamp-lint.test.mjs` (add these imports to the top, next to the existing ones):

```js
import { lintFiles } from './migration-timestamp-lint.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('./migration-timestamp-lint.mjs', import.meta.url));

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
}
```

Append these test cases at the end of the file:

```js
test('lintFiles: strip path prefix sebelum cek, multi-file semua pelanggaran ter-laporkan', () => {
  const { ok, violations } = lintFiles(
    [
      'supabase/migrations/20300103000008_foo.sql',
      'supabase/migrations/20260722100000_ok.sql',
      'supabase/migrations/20310101000000_bar.sql',
    ],
    NOW
  );
  assert.equal(ok, false);
  assert.equal(violations.length, 2);
});

test('lintFiles: semua file valid -> ok true, violations kosong', () => {
  const { ok, violations } = lintFiles(['supabase/migrations/20260722100000_ok.sql'], NOW);
  assert.equal(ok, true);
  assert.deepEqual(violations, []);
});

test('CLI: tanpa argumen exit 0 dengan pesan "Tidak ada file"', () => {
  const result = spawnSync('node', [SCRIPT_PATH], { encoding: 'utf-8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Tidak ada file migration/);
});

test('CLI: file valid (timestamp hari ini) exit 0', () => {
  const validName = `${formatTimestamp(new Date())}_ok.sql`;
  const result = spawnSync('node', [SCRIPT_PATH, validName], { encoding: 'utf-8' });
  assert.equal(result.status, 0);
});

test('CLI: file timestamp 2030 exit 1 dengan pesan pelanggaran', () => {
  const result = spawnSync('node', [SCRIPT_PATH, '20300103000008_foo.sql'], { encoding: 'utf-8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /2030-01-03/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/migration-timestamp-lint.test.mjs`
Expected: FAIL — `lintFiles is not a function` / `export named 'lintFiles' not found`, and the CLI tests fail because running the script currently does nothing (no `main()` yet, no stdout/stderr, exit code `undefined`/non-matching.

- [ ] **Step 3: Write the implementation**

Append to `scripts/migration-timestamp-lint.mjs` (after the `checkTimestamp` function, keep everything from Task 1 unchanged above this):

```js
export function lintFiles(filenames, now = new Date()) {
  const violations = [];
  for (const filename of filenames) {
    const basename = filename.split(/[\\/]/).pop();
    const result = checkTimestamp(basename, now);
    if (!result.ok) {
      violations.push(result.reason);
    }
  }
  return { ok: violations.length === 0, violations };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log('Tidak ada file migration untuk dicek.');
    process.exit(0);
  }

  const { ok, violations } = lintFiles(files);
  if (ok) {
    console.log(`✓ ${files.length} migration file timestamp wajar.`);
    process.exit(0);
  }

  console.error(`✗ Ditemukan ${violations.length} migration dengan timestamp tak wajar:\n`);
  for (const reason of violations) {
    console.error(reason + '\n');
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/migration-timestamp-lint.test.mjs`
Expected: PASS — all 11 tests green (6 from Task 1 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/migration-timestamp-lint.mjs scripts/migration-timestamp-lint.test.mjs
git commit -m "feat: add lintFiles aggregator and CLI entrypoint to migration lint"
```

---

### Task 3: Wire CI job + manual verification

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `scripts/migration-timestamp-lint.mjs` CLI contract from Task 2 (`node scripts/migration-timestamp-lint.mjs <files...>`, exit 0/1).

- [ ] **Step 1: Add the CI job**

Current end of `.github/workflows/ci.yml`:

```yaml
      - name: Type-check
        run: yarn workspace @suka/admin-dashboard type-check
      - name: Test
        run: yarn workspace @suka/admin-dashboard test
```

Append a new top-level job after the `admin-dashboard` job (same indentation as `admin-dashboard:`):

```yaml

  migration-timestamp-lint:
    name: Migration timestamps sane
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Determine newly added migration files
        id: diff
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            BASE="${{ github.event.pull_request.base.sha }}"
          else
            BASE="${{ github.event.before }}"
            if [ "$BASE" = "0000000000000000000000000000000000000000" ] || [ -z "$BASE" ]; then
              BASE="HEAD~1"
            fi
          fi
          if ! git diff --diff-filter=A --name-only "$BASE" "${{ github.sha }}" -- 'supabase/migrations/*.sql' > /tmp/added.txt; then
            echo "::error::git diff gagal (base=$BASE) — tidak bisa menentukan file migration baru. Cek fetch-depth/base SHA, JANGAN anggap 'tidak ada migration baru'." >&2
            exit 1
          fi
          cat /tmp/added.txt
      - name: Run unit tests
        run: node --test scripts/migration-timestamp-lint.test.mjs
      - name: Lint new migration timestamps
        run: |
          if [ -s /tmp/added.txt ]; then
            node scripts/migration-timestamp-lint.mjs $(cat /tmp/added.txt)
          else
            echo "Tidak ada migration baru, skip."
          fi
```

- [ ] **Step 2: Verify the job is well-formed YAML**

Run: `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml', 'utf-8'))" 2>/dev/null || python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no error printed (exit code 0). If neither `yaml` (node) nor `pyyaml` (python) is available locally, skip this step — GitHub will validate on push regardless.

- [ ] **Step 3: Manual local smoke test of the lint logic (no commit)**

Run these commands to simulate what the CI job's "Lint new migration timestamps" step would do if someone tried to land another 2030-style file, without actually adding a real migration to the repo:

```bash
node scripts/migration-timestamp-lint.mjs "supabase/migrations/20300103000008_would_be_rejected.sql"
echo "exit code: $?"
```

Expected: prints a violation block mentioning `2030-01-03` and `jangan lompat tahun`, then `exit code: 1`.

Then confirm today-dated files still pass:

```bash
node scripts/migration-timestamp-lint.mjs "supabase/migrations/20260722100000_would_be_fine.sql"
echo "exit code: $?"
```

Expected: `✓ 1 migration file timestamp wajar.` then `exit code: 0`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: reject new migration files with unreasonable timestamps"
```

---

## Post-Plan Manual Step (not code, tracked here so it isn't lost)

After this plan is merged to `main`, verify in GitHub repo settings whether branch protection for `main` requires status checks to pass before merge. If it does, add `Migration timestamps sane` to the required checks list so this job actually blocks merges, not just reports red. This is a GitHub settings change, not a file in this repo, so no task above covers it.
