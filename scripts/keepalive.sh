#!/usr/bin/env bash
# Ping tiap subdomain SUKA agar instance Passenger tetap panas (hindari cold-start).
# Pakai --resolve ke IP publik: loopback server cPanel selalu balik defaultwebpage.
# Pasang sebagai cron tiap 5 menit:
#   */5 * * * * /home/sukashaw/suka-app/scripts/keepalive.sh >/dev/null 2>&1
set -u

IP="103.77.106.237"
DOMAINS=(
  "app.sukashawarma.com"
  "stok.sukashawarma.com"
  "distribusi.sukashawarma.com"
  "absensi.sukashawarma.com"
  "owner.sukashawarma.com"
)

for d in "${DOMAINS[@]}"; do
  curl -sk -o /dev/null --max-time 20 --resolve "${d}:443:${IP}" "https://${d}/" || true
done
