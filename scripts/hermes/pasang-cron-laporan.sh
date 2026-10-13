#!/usr/bin/env bash
# ==============================================================================
# pasang-cron-laporan.sh — Wizard Pemasangan Cron Job Laporan Telegram
# ==============================================================================
# Menyiapkan dan mengaktifkan scheduler systemd timer untuk pengiriman otomatis:
# 1. Laporan Pagi Penjualan (07:00 WIB / 00:00 UTC)
# 2. Rekap Presensi Kru Operasional (11:00 WIB / 04:00 UTC)
# 3. Laporan Penutupan Malam Penjualan (22:00 WIB / 15:00 UTC)
#
# Penggunaan di VPS Hostinger (user suka-hermes):
#   ./scripts/hermes/pasang-cron-laporan.sh
#   ./scripts/hermes/pasang-cron-laporan.sh --test
#   ./scripts/hermes/pasang-cron-laporan.sh --status
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

ACTION="${1:-install}"

case "$ACTION" in
  --cek-chat|cek-chat|--chat-id)
    log_info "Memeriksa riwayat chat / grup dari Telegram Bot API..."
    python3 "$SKRIP_DIR/kirim-laporan-telegram.py" --cek-chat-id
    exit 0
    ;;
  --status|status)
    log_info "Memeriksa status timer laporan Suka Shawarma..."
    systemctl --user list-timers "suka-laporan-*" --no-pager || true
    exit 0
    ;;
  --disable|disable)
    log_warn "Menonaktifkan semua timer laporan..."
    systemctl --user disable --now suka-laporan-pagi.timer suka-laporan-absensi.timer suka-laporan-malam.timer 2>/dev/null || true
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

# 2. Salin executable python
log_info "Menyalin kirim-laporan-telegram.py ke $BIN_DIR..."
cp "$SKRIP_DIR/kirim-laporan-telegram.py" "$BIN_DIR/kirim-laporan-telegram.py"
chmod +x "$BIN_DIR/kirim-laporan-telegram.py"
log_ok "Skrip eksekusi terpasang di $BIN_DIR/kirim-laporan-telegram.py"

# 3. Salin service dan timer unit
log_info "Menyalin berkas systemd user service & timer..."
for f in suka-laporan-pagi suka-laporan-absensi suka-laporan-malam; do
  cp "$SKRIP_DIR/$f.service" "$SYSTEMD_USER_DIR/$f.service"
  cp "$SKRIP_DIR/$f.timer" "$SYSTEMD_USER_DIR/$f.timer"
done
log_ok "Berkas service & timer terpasang di $SYSTEMD_USER_DIR"

# 4. Periksa variabel environment di profil CEO
if [ -f "$CEO_ENV" ]; then
  log_info "Memeriksa konfigurasi di $CEO_ENV..."
  
  TOKEN_TERSEDIA=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$CEO_ENV" | cut -d= -f2- || true)
  CHAT_TERSEDIA=$(grep -E '^(TELEGRAM_OWNER_CHAT_ID|TELEGRAM_CHAT_ID)=' "$CEO_ENV" | head -n1 | cut -d= -f2- || true)
  MCP_TERSEDIA=$(grep -E '^SUKA_MCP_KEY=' "$CEO_ENV" | cut -d= -f2- || true)

  if [ -n "$TOKEN_TERSEDIA" ]; then
    log_ok "TELEGRAM_BOT_TOKEN terdeteksi."
  else
    log_warn "TELEGRAM_BOT_TOKEN belum ada di $CEO_ENV."
  fi

  if [ -n "$CHAT_TERSEDIA" ]; then
    log_ok "Target Chat ID terdeteksi: $CHAT_TERSEDIA"
  else
    log_warn "TELEGRAM_CHAT_ID (ID grup Owner) belum ada di $CEO_ENV."
    echo -e "   Tambahkan baris berikut ke $CEO_ENV:"
    echo -e "   ${KUNING}TELEGRAM_CHAT_ID=-100xxxxxxxxxx${NC} (ganti dengan ID grup telegram)"
  fi

  if [ -n "$MCP_TERSEDIA" ]; then
    log_ok "SUKA_MCP_KEY terdeteksi."
  else
    log_warn "SUKA_MCP_KEY belum ada di $CEO_ENV. Buat kunci di admin-dashboard Sistem -> Kunci Hermes."
  fi
else
  log_warn "File profil $CEO_ENV belum ditemukan. Pastikan bot profil ceo sudah di-setup."
fi

# 5. Reload systemd daemon dan aktifkan timer
log_info "Mengaktifkan systemd user timers..."
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
systemctl --user daemon-reload
systemctl --user enable --now suka-laporan-pagi.timer suka-laporan-absensi.timer suka-laporan-malam.timer
log_ok "Timers berhasil di-enable dan dijalankan!"

# 6. Mode test pengiriman jika diminta
if [[ "$ACTION" == "--test" || "$ACTION" == "-t" ]]; then
  echo ""
  log_info "Menguji pengiriman pesan ke Telegram sekarang..."
  "$BIN_DIR/kirim-laporan-telegram.py" --jenis test || log_warn "Uji kirim gagal, periksa token dan chat ID."
fi

echo -e "\n${BOLD}${HIJAU}======================================================${NC}"
echo -e "${BOLD}${HIJAU}          CRON JOB LAPORAN BERHASIL DIAKTIFKAN        ${NC}"
echo -e "${BOLD}${HIJAU}======================================================${NC}\n"

echo -e "${BOLD}Jadwal Pengiriman Laporan Otomatis:${NC}"
echo -e "  1. ☀️ ${BOLD}Laporan Pagi Penjualan${NC}     : 07:00 WIB (00:00 UTC) -> Omzet kemarin, perbandingan minggu lalu, ranking"
echo -e "  2. 👥 ${BOLD}Rekap Presensi Kru${NC}         : 11:00 WIB (04:00 UTC) -> Kehadiran, keterlambatan kru, cuti/izin"
echo -e "  3. 🌙 ${BOLD}Laporan Penutupan Malam${NC}    : 22:00 WIB (15:00 UTC) -> Rekap closing omzet hari ini"
echo ""
echo -e "${BOLD}Perintah Berguna:${NC}"
echo -e "  - Cek jadwal berikutnya : ${CYAN}systemctl --user list-timers \"suka-laporan-*\"${NC}"
echo -e "  - Cek log eksekusi      : ${CYAN}journalctl --user -u suka-laporan-pagi --no-pager | tail -20${NC}"
echo -e "  - Uji kirim langsung    : ${CYAN}python3 ~/bin/kirim-laporan-telegram.py --jenis pagi${NC}"
echo -e "  - Uji tanpa kirim       : ${CYAN}python3 ~/bin/kirim-laporan-telegram.py --jenis pagi --dry-run${NC}"
echo ""
