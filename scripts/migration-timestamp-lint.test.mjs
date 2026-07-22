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
