#!/bin/bash

# Pastikan script berhenti jika ada error
set -e

APP_NAME=$1

if [ -z "$APP_NAME" ]; then
  echo "========================================="
  echo "❌ Error: Nama aplikasi belum dimasukkan!"
  echo "Gunakan format: ./deploy.sh [nama_aplikasi]"
  echo "Contoh: ./deploy.sh admin-dashboard"
  echo "========================================="
  exit 1
fi

echo "🚀 [1/5] Memulai deploy untuk aplikasi: $APP_NAME..."

# Tentukan lokasi repo (tempat script ini dijalankan)
REPO_DIR=$(pwd)

# Pengecekan apakah direktori aplikasi ada
if [ ! -d "$REPO_DIR/apps/$APP_NAME" ]; then
  echo "❌ Error: Aplikasi 'apps/$APP_NAME' tidak ditemukan di repository ini!"
  exit 1
fi

# Tentukan direktori tujuan di cPanel berdasarkan nama aplikasi
if [ "$APP_NAME" == "admin-dashboard" ]; then
  TARGET_DIR="/home/sukashaw/manager.sukashawarma.com"
elif [ "$APP_NAME" == "pos-kasir" ]; then
  TARGET_DIR="/home/sukashaw/app.sukashawarma.com"
elif [ "$APP_NAME" == "finance" ]; then
  TARGET_DIR="/home/sukashaw/finance.sukashawarma.com"
elif [ "$APP_NAME" == "absensi" ]; then
  TARGET_DIR="/home/sukashaw/absen.sukashawarma.com"
else
  echo "❌ Error: Direktori tujuan (Target Directory) untuk $APP_NAME belum dikonfigurasi di dalam deploy.sh!"
  exit 1
fi

echo "📥 [2/5] Menarik pembaruan terbaru dari GitHub (branch main)..."
git pull origin main

echo "📦 [3/5] Menginstall dependencies & Membangun (build) aplikasi..."
npm install
npm run build --workspace=apps/$APP_NAME

echo "📂 [4/5] Menyalin file build (Standalone) ke folder server ($TARGET_DIR)..."
# Buat folder target jika belum ada
mkdir -p $TARGET_DIR

# Bersihkan file build lama di target agar tidak bentrok (opsional tapi disarankan)
rm -rf $TARGET_DIR/.next $TARGET_DIR/apps $TARGET_DIR/node_modules $TARGET_DIR/server.js $TARGET_DIR/package.json 2>/dev/null || true

# Copy semua file dari folder standalone
cp -a $REPO_DIR/apps/$APP_NAME/.next/standalone/. $TARGET_DIR/

# Copy folder public dan static khusus ke posisi yang diharapkan oleh server.js standalone
mkdir -p $TARGET_DIR/apps/$APP_NAME/.next
cp -a $REPO_DIR/apps/$APP_NAME/public $TARGET_DIR/apps/$APP_NAME/ 2>/dev/null || true
cp -a $REPO_DIR/apps/$APP_NAME/.next/static $TARGET_DIR/apps/$APP_NAME/.next/

echo "🔄 [5/5] Merestart aplikasi cPanel (Phusion Passenger)..."
mkdir -p $TARGET_DIR/tmp
touch $TARGET_DIR/tmp/restart.txt

echo "========================================="
echo "✅ DEPLOY SUKSES! Aplikasi $APP_NAME sudah diperbarui."
echo "========================================="
