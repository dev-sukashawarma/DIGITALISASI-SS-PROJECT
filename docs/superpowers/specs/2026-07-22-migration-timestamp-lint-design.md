# Migration Timestamp Lint Design

## 1. Context & Goal

Pada 21 Juli 2026, migration `ledger_stamp_saldo()` (fungsi trigger yang menjaga saldo `stok_balance` tetap akurat) tertimpa balik oleh versi lama yang rusak. Root cause: commit `1c4fc9cc` me-*rename* beberapa file migration (mis. `20260718000000_update_trigger_hq.sql`) menjadi berawalan timestamp **`2030...`**, kemungkinan untuk menghindari bentrok nama file saat merge. Karena migration Supabase dijalankan berurutan berdasarkan nama file, file berawalan `2030` **selalu jalan paling akhir, permanen** — diam-diam menimpa balik perbaikan apa pun yang menyentuh objek database yang sama, walau perbaikan itu di-commit belakangan.

Dampak nyata insiden ini: selama ~2,5 jam (11:06 UTC), 2.275 baris ledger `pemakaian` di 6 outlet gagal ter-refleksi ke `stok_balance` dengan benar, memicu saldo minus di beberapa item (mis. SAPI di outlet Empang, -14.48).

Ini adalah **kejadian kedua** dengan pola identik — sebelumnya menimpa `trg_process_bom_stok` (didokumentasikan di sesi 2026-07-21, bug hunt POS-Kasir). Kedua kali, resolusinya reaktif: tambah migration baru bernomor lebih besar dari ranjau (bukan rename, karena rename memicu masalah `migration repair` di riwayat migration yang sudah applied).

**Tujuan fitur ini:** cegah ranjau timestamp seperti ini terjadi lagi, dengan menolak (fail CI) migration file baru yang timestamp-nya tidak wajar, SEBELUM sempat ter-merge/ter-apply ke database.

## 2. Scope & Constraints

- **Cakupan cek:** hanya file **baru** yang ditambahkan ke `supabase/migrations/*.sql` dalam satu push/PR (via `git diff --diff-filter=A`). **Bukan** seluruh folder — 9 file `2030*` yang sudah live tidak disentuh/tidak perlu lolos cek ini (rename mereka sekarang = risiko migration-history drift yang sudah didokumentasikan sebagai gotcha proyek ini).
- **Aturan validasi:** filename harus berpola `YYYYMMDDHHMMSS_deskripsi.sql`. Timestamp yang di-parse harus berada dalam jendela **-30 hari sampai +2 hari** dari tanggal commit berjalan (UTC).
  - Batas belakang (30 hari) longgar — toleran ke PR yang nangkring lama sebelum merge.
  - Batas depan (2 hari) ketat — nyaris tak ada alasan sah bikin migration bertanggal masa depan; ini pola yang harus ditangkap.
  - Filename yang tidak cocok pola 14-digit → dilewati dengan warning, TIDAK membuat job gagal (di luar cakupan tugas ini, hindari false-positive untuk file lain).
  - Komponen tanggal tidak valid (mis. bulan `13`) → gagal (invalid format), bonus murah untuk menangkap typo.
- **Tidak termasuk dalam scope:**
  - Tidak mengubah/merename 9 file `2030*` yang sudah ada.
  - Tidak menambah git hook lokal (husky) — repo belum punya infrastruktur ini; user memilih enforcement di CI, bukan tooling lokal baru.
  - Tidak melakukan rekonsiliasi data historis (2.275 baris ledger terdampak insiden 21 Juli) — itu topik brainstorming terpisah.

## 3. Architecture & Components

### 3.1. Script inti — `scripts/migration-timestamp-lint.mjs`

- **Fungsi murni** `checkTimestamp(filename, now = new Date())` → `{ ok: boolean, reason?: string }`.
  - Regex match `^(\d{14})_.+\.sql$`. Tidak match → `{ ok: true }` (skip, bukan tanggung jawab lint ini).
  - Parse 14 digit jadi komponen tanggal (YYYY, MM, DD, HH, mm, SS), validasi range wajar per komponen (bulan 1-12, tanggal 1-31, dst) → invalid → `{ ok: false, reason: 'format tanggal tidak valid' }`.
  - Hitung selisih hari antara tanggal ter-parse dan `now`. Di luar jendela [-30, +2] hari → `{ ok: false, reason: '<n> hari di masa depan/lampau, ...' }` dengan pesan actionable (lihat 3.2).
- **CLI wrapper** (bagian bawah file, dijalankan saat script dipanggil langsung): terima daftar path file dari `process.argv`, jalankan `checkTimestamp` ke tiap nama file (basename saja), kumpulkan SEMUA pelanggaran (bukan fail-fast di file pertama), cetak laporan, `process.exit(1)` kalau ada pelanggaran, `exit(0)` kalau bersih atau daftar kosong.

### 3.2. Pesan error

Format actionable, sertakan alasan teknis (kenapa ini berbahaya) supaya kontributor/agent paham tanpa perlu baca dokumentasi lain:

```
✗ supabase/migrations/20300103000008_foo.sql — timestamp 2030-01-03 (≈1291 hari ke depan).
  Migration bertimestamp jauh ke depan akan SELALU jalan paling akhir & bisa
  menimpa balik fix lain diam-diam (lihat insiden 2026-07-21, ledger_stamp_saldo).
  Kalau ini collision timestamp asli, geser DETIK di tanggal HARI INI — jangan lompat tahun.
```

### 3.3. Testing — `scripts/migration-timestamp-lint.test.mjs`

Pakai `node:test` + `node:assert/strict` bawaan Node (tanpa dependency baru, tidak perlu masuk workspace/vitest config app manapun). Kasus:
1. File dengan timestamp hari ini → lolos.
2. File dengan timestamp tahun 2030 → gagal, pesan sesuai format 3.2.
3. Filename tidak cocok pola 14-digit (mis. file non-migration lain) → dilewati, tidak crash.
4. Komponen tanggal tidak valid (mis. `...13320000_...` bulan 13) → gagal dengan reason format.
5. Multi-file dengan campuran valid/invalid → SEMUA pelanggaran ter-laporkan, bukan cuma yang pertama.
6. Batas jendela: -30 hari tepat → lolos; -31 hari → gagal; +2 hari tepat → lolos; +3 hari → gagal.

### 3.4. Wiring CI — job baru di `.github/workflows/ci.yml`

Job independen `migration-timestamp-lint`, tidak mengubah job `admin-dashboard` yang sudah ada:

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
          # Fallback: push pertama ke branch baru punya `before` all-zero
          if [ "$BASE" = "0000000000000000000000000000000000000000" ]; then
            BASE="HEAD~1"
          fi
        fi
        git diff --diff-filter=A --name-only "$BASE" "${{ github.sha }}" -- 'supabase/migrations/*.sql' > /tmp/added.txt || true
        cat /tmp/added.txt
    - name: Run lint
      run: |
        if [ -s /tmp/added.txt ]; then
          node scripts/migration-timestamp-lint.mjs $(cat /tmp/added.txt)
        else
          echo "Tidak ada migration baru, skip."
        fi
    - name: Run unit tests
      run: node --test scripts/migration-timestamp-lint.test.mjs
```

Trigger sama seperti job existing (`pull_request` + `push` ke `main`, sudah didefinisikan di top-level `on:` workflow — tidak perlu duplikasi).

## 4. Error Handling & Caveats

- **Job ini blocking di level CI**, tapi efektivitasnya sebagai *gate* bergantung pada GitHub branch protection `main` mewajibkan status check ini lolos sebelum merge. Status branch protection repo ini belum diverifikasi di sesi ini — perlu dicek/diaktifkan terpisah (di luar scope kode, ini setting GitHub, bukan file di repo).
- Kalau automation auto-commit (disebut di beberapa sesi sebelumnya, pernah push langsung ke `main` tanpa PR) melakukannya lagi, job `push:` tetap jalan & akan merah di GitHub Actions — itu jadi alarm cepat (menit, bukan jam) walau tidak "mencegah" push itu sendiri.
- Script harus **fail-open terhadap error tak terduga di git diff** (mis. shallow clone gagal, base SHA tak ditemukan) dengan pesan jelas, bukan silent-pass — supaya kegagalan infra CI tidak disalahartikan sebagai "tidak ada migration baru".

## 5. Next Steps

1. Tulis `scripts/migration-timestamp-lint.mjs` (fungsi murni + CLI wrapper).
2. Tulis `scripts/migration-timestamp-lint.test.mjs`, jalankan `node --test`, pastikan semua kasus di 3.3 hijau.
3. Tambah job `migration-timestamp-lint` ke `.github/workflows/ci.yml`.
4. Verifikasi manual: buat file migration dummy bertimestamp jauh ke depan di branch percobaan, konfirmasi CI menolaknya; hapus file dummy.
5. (Manual, di luar kode) Cek/aktifkan required status check `migration-timestamp-lint` di branch protection GitHub untuk `main`.
