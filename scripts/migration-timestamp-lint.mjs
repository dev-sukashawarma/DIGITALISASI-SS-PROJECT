#!/usr/bin/env node
// Cek migration timestamp tak wajar (cegah ranjau seperti insiden 2026-07-21,
// lihat docs/superpowers/specs/2026-07-22-migration-timestamp-lint-design.md).

import { fileURLToPath } from 'node:url';

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

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
