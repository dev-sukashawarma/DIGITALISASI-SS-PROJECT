#!/usr/bin/env bash
# ==============================================================================
# sentry-watchdog.sh — Skrip Pemantau Mandiri Database Supabase & VPS Hostinger
# ==============================================================================
# Dijalankan otomatis tiap 5 menit lewat systemd timer (sentry-watchdog.timer)
# Memeriksa:
# 1. Kapasitas Disk VPS (peringatan jika > 80%, kritis jika > 85%)
# 2. Penggunaan Memori RAM (peringatan jika > 90%)
# 3. Status layanan hermes-gateway
# 4. Latensi & ketersediaan koneksi Supabase
# 5. Mengirimkan notifikasi darurat ke Telegram jika ada anomali/down
# ==============================================================================
set -euo pipefail

# Konfigurasi batas ambang batas (thresholds)
AMBANG_DISK_PERINGATAN=80
AMBANG_DISK_KRITIS=85
AMBANG_RAM_KRITIS=92

LOG_FILE="${HOME}/.hermes/sentry-alerts.log"
TELEMETRI_FILE="${HOME}/.hermes/sentry-telemetry.json"
mkdir -p "${HOME}/.hermes"

# Muat token Telegram jika tersedia di profil ceo / sentry
TG_TOKEN=""
TG_CHAT_ID=""
for env_path in "${HOME}/.hermes/profiles/sentry/.env" "${HOME}/.hermes/profiles/ceo/.env"; do
  if [ -f "$env_path" ]; then
    t=$(grep -s '^TELEGRAM_BOT_TOKEN=' "$env_path" | cut -d= -f2- | tr -d '\r"')
    c=$(grep -s '^TELEGRAM_ALLOWED_USERS=' "$env_path" | cut -d= -f2- | tr -d '\r"' | cut -d, -f1)
    [ -n "$t" ] && [ -z "$TG_TOKEN" ] && TG_TOKEN="$t"
    [ -n "$c" ] && [ -z "$TG_CHAT_ID" ] && TG_CHAT_ID="$c"
  fi
done

kirim_telegram() {
  local pesan="$1"
  if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT_ID" ]; then
    curl -s -m 10 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT_ID}" \
      -d "text=${pesan}" \
      -d "parse_mode=Markdown" >/dev/null 2>&1 || true
  fi
}

SEKARANG=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
WIB=$(date +"%Y-%m-%d %H:%M:%S WIB")

# 1. Cek Disk VPS
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
DISK_FREE=$(df -h / | awk 'NR==2 {print $4}')
DISK_TOTAL=$(df -h / | awk 'NR==2 {print $2}')

# 2. Cek RAM VPS
RAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
RAM_USED=$(free -m | awk '/Mem:/ {print $3}')
RAM_PERCENT=$(( RAM_USED * 100 / RAM_TOTAL ))

# 3. Cek CPU Load
LOAD=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' ')

# 4. Cek hermes-gateway
GATEWAY_STATUS="unknown"
if command -v systemctl >/dev/null 2>&1; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  if systemctl --user is-active hermes-gateway >/dev/null 2>&1; then
    GATEWAY_STATUS="active"
  else
    GATEWAY_STATUS="inactive"
  fi
fi

# 5. Cek Konektivitas Supabase (via endpoint resmi Suka Shawarma)
DB_STATUS="unknown"
DB_LATENCY_MS="0"
DB_CHECK_URL="https://admin.sukashawarma.com/api/hermes/mcp"
MULAI_PING=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "$DB_CHECK_URL" 2>/dev/null || echo "000")
SELESAI_PING=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
DB_LATENCY_MS=$(( SELESAI_PING - MULAI_PING ))

# Endpoint MCP bila hidup mengembalikan 200, 401 (unauthorized tapi server hidup), atau 405
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "405" ]; then
  DB_STATUS="online"
elif [ "$HTTP_CODE" = "000" ]; then
  DB_STATUS="down"
else
  DB_STATUS="warning"
fi

# 6. Susun file snapshot telemetri
cat > "$TELEMETRI_FILE" << EOF
{
  "diperbarui_at": "$SEKARANG",
  "wib": "$WIB",
  "disk": {
    "usage_percent": $DISK_USAGE,
    "free": "$DISK_FREE",
    "total": "$DISK_TOTAL"
  },
  "ram": {
    "usage_percent": $RAM_PERCENT,
    "used_mb": $RAM_USED,
    "total_mb": $RAM_TOTAL
  },
  "cpu_load": "$LOAD",
  "services": {
    "hermes_gateway": "$GATEWAY_STATUS",
    "supabase_mcp": "$DB_STATUS",
    "http_code": "$HTTP_CODE",
    "latency_ms": $DB_LATENCY_MS
  }
}
EOF

# 7. Evaluasi Anomali & Kirim Peringatan Darurat
ADA_ANOMALI=false
PESAN_ALERT="🚨 *[SENTRY SYSTEM ALERT]*\n_Waktu: ${WIB}_\n"

if [ "$DISK_USAGE" -ge "$AMBANG_DISK_KRITIS" ]; then
  ADA_ANOMALI=true
  PESAN_ALERT="${PESAN_ALERT}\n⚠️ *DISK KRITIS:* ${DISK_USAGE}% terpakai (Tersisa: ${DISK_FREE}). Segera bersihkan log docker!"
fi

if [ "$RAM_PERCENT" -ge "$AMBANG_RAM_KRITIS" ]; then
  ADA_ANOMALI=true
  PESAN_ALERT="${PESAN_ALERT}\n⚠️ *RAM OVERLOAD:* ${RAM_PERCENT}% terpakai (${RAM_USED}MB / ${RAM_TOTAL}MB)."
fi

if [ "$GATEWAY_STATUS" != "active" ]; then
  ADA_ANOMALI=true
  PESAN_ALERT="${PESAN_ALERT}\n🔴 *HERMES GATEWAY DOWN:* Service hermes-gateway tidak berjalan di VPS!"
fi

if [ "$DB_STATUS" = "down" ]; then
  ADA_ANOMALI=true
  PESAN_ALERT="${PESAN_ALERT}\n🔴 *DATABASE / API UNREACHABLE:* Koneksi ke Supabase / MCP gagal (HTTP ${HTTP_CODE})."
fi

if [ "$ADA_ANOMALI" = true ]; then
  echo "[$SEKARANG] ANOMALI DETECTED! Mengirimkan alert..." >> "$LOG_FILE"
  echo "$PESAN_ALERT" >> "$LOG_FILE"
  kirim_telegram "$PESAN_ALERT"
else
  # Bersihkan log agar tidak membengkak
  if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 1000 ]; then
    tail -n 200 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
  fi
fi
