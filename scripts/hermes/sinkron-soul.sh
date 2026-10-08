#!/usr/bin/env bash
# Sinkron SOUL bot Hermes dari repo (branch main) ke profil di VPS.
# Jalan sebagai user suka-hermes lewat systemd timer (hermes-sinkron-soul.timer).
#
# Untuk tiap profil yang ADA di ~/.hermes/profiles/<p>/, ambil docs/hermes/SOUL-<p>.md.
# Tidak ada di repo (404) → profil dilewati. Baris pertama yang berupa komentar HTML
# (<!-- ... -->) dibuang. Isi sama → tidak berbuat apa-apa. Beda → cadangan lama
# disimpan, berkas baru dipasang, gateway di-restart SEKALI di akhir.
# Profil TIDAK pernah dibuat oleh skrip ini.
set -euo pipefail

REPO_RAW="${SOUL_REPO_RAW:-https://raw.githubusercontent.com/dev-sukashawarma/DIGITALISASI-SS-PROJECT/main/docs/hermes}"
PROFIL_DIR="${HERMES_PROFIL_DIR:-$HOME/.hermes/profiles}"
CADANGAN_DIR="${SOUL_CADANGAN_DIR:-$HOME/.hermes/soul-cadangan}"
MIN_BYTE=200          # isi lebih pendek dari ini dianggap unduhan rusak
RESTART="${SOUL_RESTART_CMD:-systemctl --user restart hermes-gateway}"

log() { echo "[sinkron-soul] $*"; }

if command -v flock >/dev/null 2>&1; then
  exec 9>"${XDG_RUNTIME_DIR:-/tmp}/hermes-sinkron-soul.lock"
  flock -n 9 || { log "masih ada sinkron lain yang berjalan, lewati"; exit 0; }
else
  log "flock tidak tersedia, jalan tanpa kunci"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

berubah=()
for dir in "$PROFIL_DIR"/*/; do
  [ -d "$dir" ] || continue
  p=$(basename "$dir")
  case "$p" in *[!a-z0-9_-]*) log "lewati profil bernama aneh: $p"; continue ;; esac

  mentah="$tmp/$p.raw"
  kode=$(curl -sS -L --max-time 20 -o "$mentah" -w '%{http_code}' "$REPO_RAW/SOUL-$p.md?t=$(date +%s)" 2>/dev/null || true)
  kode=${kode:-000}
  if [ "$kode" = "404" ]; then continue; fi
  if [ "$kode" != "200" ]; then log "$p: gagal unduh (HTTP $kode), SOUL lama dipertahankan"; continue; fi

  baru="$tmp/$p.md"
  if head -n1 "$mentah" | grep -qE '^[[:space:]]*<!--.*-->[[:space:]]*$'; then
    tail -n +2 "$mentah" > "$baru"
  else
    cp "$mentah" "$baru"
  fi

  ukuran=$(wc -c < "$baru")
  if [ "$ukuran" -lt "$MIN_BYTE" ] || grep -qiE '^<!doctype html|<html' "$baru"; then
    log "$p: isi unduhan tidak wajar ($ukuran byte), SOUL lama dipertahankan"
    continue
  fi

  tujuan="$dir/SOUL.md"
  if [ -f "$tujuan" ] && cmp -s "$baru" "$tujuan"; then continue; fi

  mkdir -p "$CADANGAN_DIR"
  if [ -f "$tujuan" ]; then cp "$tujuan" "$CADANGAN_DIR/$p-$(date +%Y%m%d-%H%M%S).md"; fi
  cp "$baru" "$tujuan.baru" && mv "$tujuan.baru" "$tujuan"
  log "$p: SOUL diperbarui ($ukuran byte)"
  berubah+=("$p")
done

if [ "${#berubah[@]}" -gt 0 ]; then
  log "restart gateway (profil berubah: ${berubah[*]})"
  $RESTART
fi

# Simpan maksimal 20 cadangan terbaru per profil.
if [ -d "$CADANGAN_DIR" ]; then
  for p in $(ls "$CADANGAN_DIR" 2>/dev/null | sed -E 's/-[0-9]{8}-[0-9]{6}\.md$//' | sort -u); do
    ls -1t "$CADANGAN_DIR/$p-"*.md 2>/dev/null | tail -n +21 | xargs -r rm -f
  done
fi
