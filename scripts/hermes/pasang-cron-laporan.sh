#!/usr/bin/env bash
# ==============================================================================
# pasang-cron-laporan.sh — Wizard Pemasangan Cron Job Laporan Telegram
# ==============================================================================
# Menyiapkan dan mengaktifkan scheduler systemd timer untuk pengiriman otomatis:
# 1. Sales Kemarin  : 04:00 WIB (21:00 UTC) -> Omzet kemarin, top menu, target
# 2. Absensi Kantor : 08:30 WIB (01:30 UTC) -> Kehadiran staf Kantor Pusat HQ
# 3. Absensi Outlet : 14:00 WIB (07:00 UTC) -> Kehadiran kru operasional outlet
# 4. Sales Sore     : 16:00 WIB (09:00 UTC) -> Omzet & transaksi s.d. jam 16:00
# 5. Sales Closing  : 22:00 WIB (15:00 UTC) -> Closing omzet harian s.d. jam 22:00
# 6. Marcom         : 04:01 WIB (21:01 UTC) -> Endorsement KOL & Iklan Aktif
# 7. Stok           : 04:02 WIB (21:02 UTC) -> Kondisi stok utama & Surat Jalan
# 8. Watchdog       : Tiap 2 Jam Sekali     -> Telemetri CPU, RAM, Disk VPS Hostinger
# 9. Alert Down     : Tiap 2 Menit Sekali   -> Peringatan instan darurat jika DB / server down
#
# Penggunaan di VPS Hostinger (user suka-hermes):
#   bash ~/bin/pasang-cron-laporan.sh
#   bash ~/bin/pasang-cron-laporan.sh --test
#   bash ~/bin/pasang-cron-laporan.sh --status
#   bash ~/bin/pasang-cron-laporan.sh --disable
# ==============================================================================
set -euo pipefail

HIJAU='\033[0;32m'
BIRU='\033[0;34m'
KUNING='\033[1;33m'
MERAH='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok() { echo -e "${HIJAU}[OK]${NC} $*"; }
log_warn() { echo -e "${KUNING}[PERINGATAN]${NC} $*"; }
log_err() { echo -e "${MERAH}[GALAT]${NC} $*" >&2; }

SKRIP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$HOME/bin"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
CEO_ENV="$HOME/.hermes/profiles/ceo/.env"
RAW_BASE="https://raw.githubusercontent.com/dev-sukashawarma/DIGITALISASI-SS-PROJECT/main/scripts/hermes"

DAFTAR_TIMER=(
  "suka-laporan-sales-0400"
  "suka-laporan-sales-1600"
  "suka-laporan-sales-2200"
  "suka-laporan-absensi-kantor"
  "suka-laporan-absensi-outlet"
  "suka-laporan-marcom"
  "suka-laporan-stok"
  "suka-laporan-watchdog"
  "suka-laporan-alert"
)

ACTION="${1:-install}"

case "$ACTION" in
  --cek-chat|cek-chat|--chat-id)
    log_info "Memeriksa riwayat chat / grup dari Telegram Bot API..."
    if [ -f "$BIN_DIR/kirim-laporan-telegram.py" ]; then
      python3 "$BIN_DIR/kirim-laporan-telegram.py" --cek-chat-id
    else
      python3 "$SKRIP_DIR/kirim-laporan-telegram.py" --cek-chat-id
    fi
    exit 0
    ;;
  --status|status)
    log_info "Memeriksa status 8 timer laporan Suka Shawarma..."
    systemctl --user list-timers "suka-laporan-*" --no-pager || true
    exit 0
    ;;
  --disable|disable)
    log_warn "Menonaktifkan semua timer laporan..."
    systemctl --user disable --now suka-laporan-pagi.timer suka-laporan-absensi.timer suka-laporan-malam.timer 2>/dev/null || true
    for t in "${DAFTAR_TIMER[@]}"; do
      systemctl --user disable --now "$t.timer" 2>/dev/null || true
    done
    log_ok "Semua timer laporan berhasil dinonaktifkan."
    exit 0
    ;;
esac

echo -e "\n${BOLD}${BIRU}======================================================${NC}"
echo -e "${BOLD}${BIRU}   PEMASANGAN CRON JOB LAPORAN TELEGRAM SUKA SHAWARMA ${NC}"
echo -e "${BOLD}${BIRU}======================================================${NC}\n"

USER_SEKARANG=$(id -un || whoami)
if [ "$USER_SEKARANG" = "root" ]; then
  log_warn "Skrip berjalan sebagai ROOT. Bot Suka Shawarma seharusnya berada di user 'suka-hermes'."
  log_warn "Pertimbangkan berpindah user: 'su - suka-hermes'"
fi

# 1. Pastikan direktori tujuan ada
mkdir -p "$BIN_DIR" "$SYSTEMD_USER_DIR"

# 2. Salin atau unduh executable python (selalu perbarui dengan versi terbaru)
log_info "Menyiapkan skrip eksekusi di $BIN_DIR..."
if [ -f "$SKRIP_DIR/kirim-laporan-telegram.py" ] && [ "$SKRIP_DIR" != "$BIN_DIR" ]; then
  cp -f "$SKRIP_DIR/kirim-laporan-telegram.py" "$BIN_DIR/kirim-laporan-telegram.py"
else
  curl -fsSL "$RAW_BASE/kirim-laporan-telegram.py" -o "$BIN_DIR/kirim-laporan-telegram.py"
fi
chmod +x "$BIN_DIR/kirim-laporan-telegram.py"

if [ -f "$SKRIP_DIR/mcp-vps-telemetri.py" ] && [ "$SKRIP_DIR" != "$BIN_DIR" ]; then
  cp -f "$SKRIP_DIR/mcp-vps-telemetri.py" "$BIN_DIR/mcp-vps-telemetri.py"
else
  curl -fsSL "$RAW_BASE/mcp-vps-telemetri.py" -o "$BIN_DIR/mcp-vps-telemetri.py" 2>/dev/null || true
fi
[ -f "$BIN_DIR/mcp-vps-telemetri.py" ] && chmod +x "$BIN_DIR/mcp-vps-telemetri.py"
log_ok "Skrip eksekusi siap di $BIN_DIR"

# 3. Nonaktifkan timer lama (jika ada) untuk menghindari duplikasi
systemctl --user disable --now suka-laporan-pagi.timer suka-laporan-absensi.timer suka-laporan-malam.timer suka-laporan-sales-2100.timer 2>/dev/null || true

# 4. Salin atau unduh 8 berkas systemd user service & timer
log_info "Memasang 8 berkas systemd user service & timer..."
for t in "${DAFTAR_TIMER[@]}"; do
  for ext in service timer; do
    target_file="$SYSTEMD_USER_DIR/$t.$ext"
    source_file="$SKRIP_DIR/$t.$ext"
    if [ -f "$source_file" ] && [ "$SKRIP_DIR" != "$SYSTEMD_USER_DIR" ]; then
      cp "$source_file" "$target_file"
    else
      curl -fsSL "$RAW_BASE/$t.$ext" -o "$target_file"
    fi
  done
done
log_ok "Seluruh berkas service & timer terpasang di $SYSTEMD_USER_DIR"

# 5. Periksa variabel environment di profil CEO
if [ -f "$CEO_ENV" ]; then
  log_info "Memeriksa konfigurasi di $CEO_ENV..."
  
  TOKEN_TERSEDIA=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$CEO_ENV" | cut -d= -f2- || true)
  CHAT_TERSEDIA=$(grep -E '^(TELEGRAM_OWNER_CHAT_ID|TELEGRAM_CHAT_ID)=' "$CEO_ENV" | head -n1 | cut -d= -f2- || true)
  ALLOWED_USERS=$(grep -E '^TELEGRAM_ALLOWED_USERS=' "$CEO_ENV" | cut -d= -f2- || true)
  MCP_TERSEDIA=$(grep -E '^SUKA_MCP_KEY=' "$CEO_ENV" | cut -d= -f2- || true)

  if [ -n "$TOKEN_TERSEDIA" ]; then
    log_ok "TELEGRAM_BOT_TOKEN terdeteksi."
  else
    log_warn "TELEGRAM_BOT_TOKEN belum ada di $CEO_ENV."
  fi

  if [ -n "$CHAT_TERSEDIA" ]; then
    log_ok "Target Chat ID terdeteksi: $CHAT_TERSEDIA"
  elif [ -n "$ALLOWED_USERS" ]; then
    log_ok "Chat ID otomatis menggunakan Telegram Allowed User: $(echo "$ALLOWED_USERS" | cut -d, -f1)"
  else
    log_warn "TELEGRAM_OWNER_CHAT_ID belum ada di $CEO_ENV."
  fi

  if [ -n "$MCP_TERSEDIA" ]; then
    log_ok "SUKA_MCP_KEY terdeteksi."
  else
    log_warn "SUKA_MCP_KEY belum ada di $CEO_ENV. Buat kunci di admin-dashboard Sistem -> Kunci Hermes."
  fi
else
  log_warn "File profil $CEO_ENV belum ditemukan. Pastikan bot profil ceo sudah di-setup."
fi

# 6. Reload systemd daemon dan aktifkan timer baru
log_info "Mengaktifkan systemd user timers..."
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user daemon-reload

TIMER_FILES=()
for t in "${DAFTAR_TIMER[@]}"; do
  TIMER_FILES+=("$t.timer")
done

systemctl --user enable --now "${TIMER_FILES[@]}"
log_ok "8 Timer berhasil di-enable dan dijalankan!"

# 7. Mode test pengiriman jika diminta
if [[ "$ACTION" == "--test" || "$ACTION" == "-t" ]]; then
  echo ""
  log_info "Menguji pengiriman pesan ke Telegram sekarang..."
  "$BIN_DIR/kirim-laporan-telegram.py" --jenis test || log_warn "Uji kirim gagal, periksa token dan chat ID."
fi

echo -e "\n${BOLD}${HIJAU}======================================================${NC}"
echo -e "${BOLD}${HIJAU}          9 JADWAL CRON JOB RESMI DIAKTIFKAN          ${NC}"
echo -e "${BOLD}${HIJAU}======================================================${NC}\n"

echo -e "${BOLD}Jadwal Pengiriman Laporan & Pengawasan Otomatis ke Telegram:${NC}"
echo -e "  1. 💰 ${BOLD}Sales Kemarin${NC}       : 04:00 WIB (21:00 UTC) -> Omzet kemarin, top menu, target"
echo -e "  2. 👥 ${BOLD}Absensi Kantor${NC}      : 08:30 WIB (01:30 UTC) -> Kehadiran khusus staff kantor HQ"
echo -e "  3. 🛵 ${BOLD}Absensi Outlet${NC}      : 14:00 WIB (07:00 UTC) -> Kehadiran kru operasional outlet"
echo -e "  4. 📊 ${BOLD}Sales Sore${NC}          : 16:00 WIB (09:00 UTC) -> Omzet & transaksi s.d. jam 16:00"
echo -e "  5. 🌙 ${BOLD}Sales Closing Malam${NC} : 22:00 WIB (15:00 UTC) -> Rekap closing omzet hari ini"
echo -e "  6. 📢 ${BOLD}Marcom Ads & KOL${NC}    : 04:01 WIB (21:01 UTC) -> Endorsement & ads yang berjalan"
echo -e "  7. 📦 ${BOLD}Stok & Gudang${NC}       : 04:02 WIB (21:02 UTC) -> Kondisi stok utama & surat jalan"
echo -e "  8. 🛡️ ${BOLD}Sistem Watchdog${NC}     : Tiap 2 Jam Sekali     -> Telemetri CPU, RAM, Disk VPS & DB"
echo -e "  9. 🚨 ${BOLD}Alert Gangguan (Down)${NC}: Tiap 2 Menit (Background) -> Notifikasi darurat instan jika down"
echo ""
echo -e "${BOLD}Perintah Pemantauan:${NC}"
echo -e "  - Cek 9 timer aktif     : ${CYAN}systemctl --user list-timers \"suka-laporan-*\"${NC}"
echo -e "  - Uji kirim watchdog    : ${CYAN}python3 ~/bin/kirim-laporan-telegram.py --jenis watchdog${NC}"
echo -e "  - Uji kirim sales sore  : ${CYAN}python3 ~/bin/kirim-laporan-telegram.py --jenis sales-sore${NC}"
echo -e "  - Uji simulasi alert    : ${CYAN}python3 ~/bin/kirim-laporan-telegram.py --jenis alert-check --dry-run${NC}"
echo -e "  - Uji tanpa kirim (dry) : ${CYAN}python3 ~/bin/kirim-laporan-telegram.py --jenis stok --dry-run${NC}"
echo ""
