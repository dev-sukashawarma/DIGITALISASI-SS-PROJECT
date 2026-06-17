#!/bin/bash
# deploy.sh — Deploy/update app ke produksi cPanel CloudLinux.
#
# Pakai:
#   ./deploy.sh <app> [--no-pull] [--no-restart] [--free-nproc]
#   ./deploy.sh all       [flags]      # build SEMUA app, serial (aman NPROC)
#   ./deploy.sh --changed [flags]      # pull lalu build HANYA app yg berubah
#
# Contoh:
#   ./deploy.sh stok                  # pull + build + restart stok
#   ./deploy.sh portal --no-pull      # skip git pull (sudah pull manual)
#   ./deploy.sh distribusi --free-nproc   # stop semua app dulu (kalau build EAGAIN)
#   ./deploy.sh --changed             # pull, build hanya yg berubah sejak commit lama
#   ./deploy.sh all                   # build semua app satu per satu
#
# Apps: portal absensi stok distribusi owner-dashboard pos-kasir

set -o pipefail

# --- Konfigurasi server (sesuai CLAUDE.md) ---
REPO_DIR="/home/sukashaw/suka-app"
NODE="/opt/alt/alt-nodejs24/root/usr/bin/node"
NPM="/opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js"
NODE_BIN_DIR="/opt/alt/alt-nodejs24/root/usr/bin"
SERVER_IP="103.77.106.237"

ALL_APPS="portal absensi stok distribusi owner-dashboard pos-kasir"

# --- Map app -> subdomain (portal pakai app.sukashawarma.com) ---
subdomain_for() {
  case "$1" in
    portal)          echo "app.sukashawarma.com" ;;
    absensi)         echo "absensi.sukashawarma.com" ;;
    stok)            echo "stok.sukashawarma.com" ;;
    distribusi)      echo "distribusi.sukashawarma.com" ;;
    owner-dashboard) echo "owner-dashboard.sukashawarma.com" ;;
    pos-kasir)       echo "pos.sukashawarma.com" ;;
    *)               echo "" ;;
  esac
}

# --- Parse argumen ---
TARGET="$1"
shift 2>/dev/null
DO_PULL=1
DO_RESTART=1
FREE_NPROC=0
for arg in "$@"; do
  case "$arg" in
    --no-pull)    DO_PULL=0 ;;
    --no-restart) DO_RESTART=0 ;;
    --free-nproc) FREE_NPROC=1 ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "❌ Pakai: ./deploy.sh <app|all|--changed> [--no-pull] [--no-restart] [--free-nproc]"
  echo "   Apps: $ALL_APPS"
  exit 1
fi

# --- Wajib: node di PATH untuk postinstall script ---
export PATH="$NODE_BIN_DIR:$PATH"
export UV_THREADPOOL_SIZE=2

# --- Git pull (buang file auto-generated dulu biar mulus) ---
# Catatan: capture OLD sebelum pull supaya --changed bisa diff range pull.
OLD_REV=""
if [ "$DO_PULL" = "1" ]; then
  echo "📥 Git pull..."
  cd "$REPO_DIR" || exit 1
  OLD_REV="$(git rev-parse HEAD 2>/dev/null)"
  git checkout -- . 2>/dev/null
  git pull origin main || { echo "❌ git pull gagal"; exit 1; }
  NEW_REV="$(git rev-parse HEAD 2>/dev/null)"
else
  echo "⏭️  Skip git pull (--no-pull)"
fi

# --- Tentukan daftar app yang akan dibuild ---
APPS_TO_BUILD=""

if [ "$TARGET" = "all" ]; then
  APPS_TO_BUILD="$ALL_APPS"

elif [ "$TARGET" = "--changed" ]; then
  if [ "$DO_PULL" != "1" ] || [ -z "$OLD_REV" ]; then
    echo "❌ --changed butuh git pull (jangan gabung dengan --no-pull)."
    exit 1
  fi
  if [ "$OLD_REV" = "$NEW_REV" ]; then
    echo "✅ Tidak ada commit baru — tidak ada yang perlu dibuild."
    exit 0
  fi
  CHANGED_FILES="$(git diff --name-only "$OLD_REV" "$NEW_REV")"
  # Perubahan shared (packages/* atau lockfile) → rebuild SEMUA app
  if echo "$CHANGED_FILES" | grep -qE '^(packages/|yarn\.lock|package\.json)'; then
    echo "📦 Perubahan shared terdeteksi (packages/ atau lockfile) → rebuild semua app."
    APPS_TO_BUILD="$ALL_APPS"
  else
    for a in $ALL_APPS; do
      if echo "$CHANGED_FILES" | grep -qE "^apps/$a/"; then
        APPS_TO_BUILD="$APPS_TO_BUILD $a"
      fi
    done
  fi
  if [ -z "$APPS_TO_BUILD" ]; then
    echo "✅ Ada commit baru tapi tidak menyentuh app mana pun (mis. docs) — skip build."
    exit 0
  fi
  echo "🎯 App berubah:$APPS_TO_BUILD"

else
  # Single app
  if [ -z "$(subdomain_for "$TARGET")" ]; then
    echo "❌ App tidak dikenal: $TARGET"
    echo "   Apps: $ALL_APPS  (atau: all, --changed)"
    exit 1
  fi
  APPS_TO_BUILD="$TARGET"
fi

# --- Build + restart satu app ---
deploy_one() {
  local APP="$1"
  local DOMAIN APP_DIR BUILD_EXIT CODE
  DOMAIN="$(subdomain_for "$APP")"
  APP_DIR="$REPO_DIR/apps/$APP"

  if [ ! -d "$APP_DIR" ]; then
    echo "❌ Folder app tidak ada: $APP_DIR"
    return 1
  fi

  echo "=========================================="
  echo "🚀 Deploy: $APP  →  https://$DOMAIN"
  echo "=========================================="

  # Build (constraint NPROC: taskset + threadpool kecil)
  echo "🔨 Build $APP..."
  cd "$APP_DIR" || return 1

  if [ "$FREE_NPROC" = "1" ]; then
    echo "   ⚠️  --free-nproc: stop sementara semua app Node (auto-respawn nanti)"
    pkill -f "lsnode:/home/sukashaw" 2>/dev/null
    sleep 3
  fi

  if command -v taskset >/dev/null 2>&1; then
    taskset -c 0,1 "$NODE" "$NPM" run build
    BUILD_EXIT=$?
  else
    "$NODE" "$NPM" run build
    BUILD_EXIT=$?
  fi

  if [ "$BUILD_EXIT" != "0" ]; then
    echo "❌ Build $APP gagal (exit $BUILD_EXIT)."
    echo "   Kalau EAGAIN/pthread → ulangi: ./deploy.sh $APP --no-pull --free-nproc"
    return 1
  fi

  if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
    echo "❌ $APP: .next/BUILD_ID tidak ada — build tidak lengkap."
    return 1
  fi
  echo "   ✅ Build $APP sukses (.next/BUILD_ID ada)"

  # Restart
  if [ "$DO_RESTART" = "1" ]; then
    echo "♻️  Restart $APP..."
    pkill -f "lsnode:/home/sukashaw/$DOMAIN" 2>/dev/null
    sleep 5
    CODE=$(curl -sk --resolve "$DOMAIN:443:$SERVER_IP" "https://$DOMAIN/" -m 25 -o /dev/null -w "%{http_code}")
    echo "   HTTP $CODE  (200/307 = live, 503 = coba akses lagi sebentar)"
  else
    echo "⏭️  Skip restart $APP (--no-restart)"
  fi
  return 0
}

# --- Eksekusi serial (satu per satu → aman NPROC) ---
FAILED=""
OK=""
for app in $APPS_TO_BUILD; do
  if deploy_one "$app"; then
    OK="$OK $app"
  else
    FAILED="$FAILED $app"
  fi
done

echo "=========================================="
echo "✅ Sukses:$OK"
[ -n "$FAILED" ] && echo "❌ Gagal:$FAILED"
echo "=========================================="
[ -n "$FAILED" ] && exit 1
exit 0
