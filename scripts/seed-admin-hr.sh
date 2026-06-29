#!/usr/bin/env bash
# Script untuk membuat user Admin HR via node script create_user.mjs
# Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local sudah benar
# Menjalankan: ./scripts/seed-admin-hr.sh

set -e

# Nama file script Node
SCRIPT="scripts/create_user.mjs"
if [ ! -f "$SCRIPT" ]; then
  echo "Error: $SCRIPT tidak ditemukan!"
  exit 1
fi

# ID Outlet Default untuk HR (bisa diganti sesuai dengan UUID outlet di Supabase)
# Misalnya, ambil dari salah satu UUID outlet yang ada di tabel outlets.
# Untuk contoh ini, saya pakai placeholder, tapi pastikan ini adalah UUID valid jika foreign key required.
# Jika tidak required, bisa dikosongkan.
OUTLET_ID="ffffffff-ffff-ffff-ffff-ffffffffffff" # UUID statis Kantor Pusat

echo "Membuat akun Admin HR..."

node "$SCRIPT" \
  --email "hr.admin@sukashawarma.com" \
  --password "sukashawarmaHR2026!" \
  --name "Bapak HR Pusat" \
  --username "hradmin" \
  --role "admin_hr" \
  --outlet "$OUTLET_ID"

echo "Selesai!"
