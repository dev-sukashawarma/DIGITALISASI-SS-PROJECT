#!/usr/bin/env bash
# Menjalankan baseline Owner Dashboard + Mitra P&L dan menulis hasil
# ternormalisasi (Ruling R1 — rows JSON saja, tanpa boundary token acak) ke
# baseline-<label>-owner.txt dan baseline-<label>-mitra.txt di direktori ini.
#
# Kenapa owner dipecah per periode (lihat juga header baseline_owner.sql):
# CROSS JOIN 2 periode × 31 target outlet = 62 pemanggilan
# get_owner_dashboard_summary dalam satu statement melebihi batas keras
# gateway Management API Supabase (~100 detik per panggilan HTTP CLI,
# independen dari statement_timeout Postgres) — pernah gagal dengan
# Cloudflare 524. Dipecah per periode (baseline_owner_2026-08.sql,
# baseline_owner_2026-09.sql — masing-masing tetap CROSS JOIN 31 outlet,
# ~10-17 detik) tetap di bawah batas itu. Mitra (baseline_mitra.sql) jalan
# utuh dalam satu panggilan (~4-8 detik), tidak perlu dipecah.
#
# Usage:
#   bash supabase/verifikasi/riwayat_hpp/jalankan_baseline.sh <label>
#   contoh label: sebelum | sesudah | cek
#
# Exit non-zero pada kegagalan apa pun (set -euo pipefail) — kegagalan di
# tengah jalan TIDAK meninggalkan baseline-<label>-*.txt setengah jadi,
# karena setiap berkas keluaran hanya ditulis setelah SEMUA panggilan CLI
# yang menyusunnya sukses (ke berkas sementara dulu, baru digabung/disalin).

set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: $0 <label>  (contoh: sebelum | sesudah | cek)" >&2
  exit 1
fi

LABEL="$1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# `supabase db query --linked` hanya berhasil resolve project link bila
# dijalankan dari root repo (tempat supabase/config.toml berada) — cd ke
# direktori skrip ini (dua level lebih dalam) membuatnya gagal dengan
# LegacyProjectNotLinkedError. File SQL tetap dirujuk lewat path absolut $DIR.
REPO_ROOT="$(git -C "$DIR" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# --- Skrip node untuk normalisasi (Ruling R1) ---------------------------
# Baca satu berkas output CLI mentah, keluarkan rows JSON saja.
NODE_ROWS_ONLY='
const fs = require("fs");
const s = fs.readFileSync(process.argv[1], "utf8");
const j = JSON.parse(s.slice(s.indexOf("{")));
console.log(JSON.stringify(j.rows, null, 1));
'
# Baca dua berkas output CLI mentah (Agustus, September), gabung rows-nya
# dengan urutan Agustus dulu (identik dengan ORDER BY periode di query asli).
NODE_MERGE_OWNER='
const fs = require("fs");
function parseRows(p){
  const s = fs.readFileSync(p, "utf8");
  const j = JSON.parse(s.slice(s.indexOf("{")));
  return j.rows;
}
const aug = parseRows(process.argv[1]);
const sep = parseRows(process.argv[2]);
console.log(JSON.stringify(aug.concat(sep), null, 1));
'

TMP_AUG="$(mktemp)"
TMP_SEP="$(mktemp)"
TMP_MITRA="$(mktemp)"
cleanup() { rm -f "$TMP_AUG" "$TMP_SEP" "$TMP_MITRA"; }
trap cleanup EXIT

echo "[owner] periode 2026-08 ..." >&2
supabase db query --linked -f "$DIR/baseline_owner_2026-08.sql" > "$TMP_AUG"

echo "[owner] periode 2026-09-01..24 ..." >&2
supabase db query --linked -f "$DIR/baseline_owner_2026-09.sql" > "$TMP_SEP"

node -e "$NODE_MERGE_OWNER" "$(cygpath -w "$TMP_AUG")" "$(cygpath -w "$TMP_SEP")" \
  > "$DIR/baseline-${LABEL}-owner.txt"

echo "[mitra] ..." >&2
supabase db query --linked -f "$DIR/baseline_mitra.sql" > "$TMP_MITRA"

node -e "$NODE_ROWS_ONLY" "$(cygpath -w "$TMP_MITRA")" \
  > "$DIR/baseline-${LABEL}-mitra.txt"

echo "OK: baseline-${LABEL}-owner.txt & baseline-${LABEL}-mitra.txt ditulis di $DIR" >&2
