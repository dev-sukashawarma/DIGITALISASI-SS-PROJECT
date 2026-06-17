#!/bin/bash
# deploy.sh — Deploy/update satu app ke produksi cPanel CloudLinux.
#
# Pakai:
#   ./deploy.sh <app> [--no-pull] [--no-restart] [--free-nproc]
#
# Contoh:
#   ./deploy.sh stok                 # pull + build + restart stok
#   ./deploy.sh portal --no-pull     # skip git pull (sudah pull manual)
#   ./deploy.sh distribusi --free-nproc   # stop semua app dulu (kalau build EAGAIN)
#
# Apps: portal absensi stok distribusi owner-dashboard pos-kasir

set -o pipefail

# --- Konfigurasi server (sesuai CLAUDE.md) ---
REPO_DIR="/home/sukashaw/suka-app"
NODE="/opt/alt/alt-nodejs24/root/usr/bin/node"
NPM="/opt/alt/alt-nodejs24/root/usr/lib/node_modules/npm/bin/npm-cli.js"
NODE_BIN_DIR="/opt/alt/alt-nodejs24/root/usr/bin"
SERVER_IP="103.77.106.237"

# --- Map app -> subdomain (portal pakai app.sukashawarma.com) ---
subdomain_for() {
  case "$1" in
    portal)          echo "app.sukashawarma.com" ;;
    absensi)         echo "absensi.sukashawarma.com" ;;
    stok)            echo "stok.sukashawarma.com" ;;
    distribusi)      echo "distribusi.sukashawarma.com" ;;
    owner-dashboard) echo "owner-dashboard.sukashawarma.com" ;;
    pos-kasir)       echo "pos-kasir.sukashawarma.com" ;;
    *)               echo "" ;;
  esac
}

# --- Parse argumen ---
APP="$1"
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

if [ -z "$APP" ]; then
  echo "❌ Pakai: ./deploy.sh <app> [--no-pull] [--no-restart] [--free-nproc]"
  echo "   Apps: portal absensi stok distribusi owner-dashboard pos-kasir"
  exit 1
fi

DOMAIN="$(subdomain_for "$APP")"
if [ -z "$DOMAIN" ]; then
  echo "❌ App tidak dikenal: $APP"
  exit 1
fi

APP_DIR="$REPO_DIR/apps/$APP"
if [ ! -d "$APP_DIR" ]; then
  echo "❌ Folder app tidak ada: $APP_DIR"
  exit 1
fi

echo "=========================================="
echo "🚀 Deploy: $APP  →  https://$DOMAIN"
echo "=========================================="

# --- Wajib: node di PATH untuk postinstall script ---
export PATH="$NODE_BIN_DIR:$PATH"
export UV_THREADPOOL_SIZE=2

# --- 1. Git pull (buang file auto-generated dulu biar mulus) ---
if [ "$DO_PULL" = "1" ]; then
  echo "📥 [1/3] Git pull..."
  cd "$REPO_DIR" || exit 1
  git checkout -- . 2>/dev/null
  git pull origin main || { echo "❌ git pull gagal"; exit 1; }
else
  echo "⏭️  [1/3] Skip git pull (--no-pull)"
fi

# --- 2. Build (constraint NPROC: taskset + threadpool kecil) ---
echo "🔨 [2/3] Build $APP..."
cd "$APP_DIR" || exit 1

if [ "$FREE_NPROC" = "1" ]; then
  echo "   ⚠️  --free-nproc: stop sementara semua app Node (auto-respawn nanti)"
  pkill -f "lsnode:/home/sukashaw" 2>/dev/null
  sleep 3
fi

# Pakai taskset kalau ada (batasi core → worker sedikit → hindari EAGAIN/pthread)
if command -v taskset >/dev/null 2>&1; then
  taskset -c 0,1 "$NODE" "$NPM" run build
  BUILD_EXIT=$?
else
  "$NODE" "$NPM" run build
  BUILD_EXIT=$?
fi

if [ "$BUILD_EXIT" != "0" ]; then
  echo "❌ Build gagal (exit $BUILD_EXIT)."
  echo "   Kalau EAGAIN/pthread → ulangi dengan: ./deploy.sh $APP --no-pull --free-nproc"
  exit 1
fi

# Verifikasi build valid
if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
  echo "❌ .next/BUILD_ID tidak ada — build tidak lengkap."
  exit 1
fi
echo "   ✅ Build sukses (.next/BUILD_ID ada)"

# --- 3. Restart app ---
if [ "$DO_RESTART" = "1" ]; then
  echo "♻️  [3/3] Restart $APP..."
  pkill -f "lsnode:/home/sukashaw/$DOMAIN" 2>/dev/null
  sleep 5
  # Trigger respawn via request (LiteSpeed spawn on-demand)
  CODE=$(curl -sk --resolve "$DOMAIN:443:$SERVER_IP" "https://$DOMAIN/" -m 25 -o /dev/null -w "%{http_code}")
  echo "   HTTP $CODE  (200/307 = live, 503 = coba akses lagi sebentar)"
else
  echo "⏭️  [3/3] Skip restart (--no-restart)"
fi

echo "=========================================="
echo "✅ Selesai: $APP → https://$DOMAIN"
echo "=========================================="
