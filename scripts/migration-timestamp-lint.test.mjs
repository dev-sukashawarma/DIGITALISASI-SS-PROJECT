import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTimestamp, lintFiles } from './migration-timestamp-lint.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('./migration-timestamp-lint.mjs', import.meta.url));

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0];
}

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
