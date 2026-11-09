#!/usr/bin/env node
// Paritas aplikasi pelanggan Android <-> iOS (keputusan owner 2026-11-09:
// "kalau ada perubahan, keduanya diperbarui bersamaan"). Gagal bila sebuah
// PR/push mengubah kode SATU aplikasi tanpa menyentuh yang lain, kecuali
// pesan commit / judul / isi PR memuat penanda pengecualian yang disengaja.
// Lihat mobile/PARITAS.md.
//
// Pemakaian: node scripts/paritas-aplikasi-pelanggan.mjs <berkas-teks-perubahan> <berkas-teks-pesan>
//   - berkas pertama: daftar path yang berubah, satu per baris (git diff --name-only)
//   - berkas kedua : gabungan pesan commit + judul/isi PR (boleh kosong)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Kode perilaku saja. Ikon, Gradle, Xcode project, aset toko, dsb. memang khas platform. */
const ANDROID = /^mobile\/customer-app\/app\/src\/main\/java\/.+\.kt$/;
const IOS = /^mobile\/customer-ios-app\/SukaShawarma\/.+\.swift$/;

export const PENANDA_HANYA_ANDROID = '[hanya-android]';
export const PENANDA_HANYA_IOS = '[hanya-ios]';

/**
 * Penanda hanya sah di AWAL baris dan diikuti alasan, mis.
 * `[hanya-ios] Sign in with Apple tidak ada di Android`. Menyebut penanda di
 * tengah kalimat (mis. saat menjelaskan aturan ini) TIDAK meloloskan.
 */
function adaPenanda(pesan, penanda) {
  return pesan.split('\n').some((baris) => {
    const b = baris.trim().toLowerCase();
    return b.startsWith(penanda) && b.slice(penanda.length).trim().length > 0;
  });
}

/**
 * @param {string[]} berkas path yang berubah
 * @param {string} pesan pesan commit + PR
 * @returns {{ ok: true, alasan: string } | { ok: false, alasan: string }}
 */
export function periksaParitas(berkas, pesan = '') {
  const android = berkas.filter((b) => ANDROID.test(b));
  const ios = berkas.filter((b) => IOS.test(b));

  if (android.length === 0 && ios.length === 0) return { ok: true, alasan: 'Aplikasi pelanggan tidak berubah.' };
  if (android.length > 0 && ios.length > 0) return { ok: true, alasan: 'Android dan iOS sama-sama berubah.' };

  if (android.length > 0) {
    if (adaPenanda(pesan, PENANDA_HANYA_ANDROID)) {
      return { ok: true, alasan: `Hanya Android berubah, ditandai ${PENANDA_HANYA_ANDROID}.` };
    }
    return {
      ok: false,
      alasan:
        `Kode Android aplikasi pelanggan berubah (${android.length} berkas, mis. ${android[0]}) ` +
        `tanpa perubahan di mobile/customer-ios-app. Port perubahannya ke iOS di PR yang sama, ` +
        `atau bila memang khusus Android tulis satu baris diawali ${PENANDA_HANYA_ANDROID} diikuti alasannya di pesan commit/PR.`,
    };
  }
  if (adaPenanda(pesan, PENANDA_HANYA_IOS)) {
    return { ok: true, alasan: `Hanya iOS berubah, ditandai ${PENANDA_HANYA_IOS}.` };
  }
  return {
    ok: false,
    alasan:
      `Kode iOS aplikasi pelanggan berubah (${ios.length} berkas, mis. ${ios[0]}) ` +
      `tanpa perubahan di mobile/customer-app. Port perubahannya ke Android di PR yang sama, ` +
      `atau bila memang khusus iOS tulis satu baris diawali ${PENANDA_HANYA_IOS} diikuti alasannya di pesan commit/PR.`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [fileBerkas, filePesan] = process.argv.slice(2);
  if (!fileBerkas) {
    console.error('Pemakaian: paritas-aplikasi-pelanggan.mjs <daftar-berkas> [pesan]');
    process.exit(2);
  }
  const berkas = readFileSync(fileBerkas, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const pesan = filePesan ? readFileSync(filePesan, 'utf8') : '';
  const hasil = periksaParitas(berkas, pesan);
  if (hasil.ok) {
    console.log(hasil.alasan);
  } else {
    console.error(`::error::${hasil.alasan}`);
    process.exit(1);
  }
}
