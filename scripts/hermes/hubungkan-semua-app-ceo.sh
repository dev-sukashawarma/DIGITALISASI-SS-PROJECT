#!/usr/bin/env bash
# ==============================================================================
# hubungkan-semua-app-ceo.sh — Hubungkan Seluruh Aplikasi & MCP ke Bot CEO
# ==============================================================================
# Menghubungkan seluruh domain & server MCP ke profile 'ceo' di VPS Hermes:
# 1. MCP suka (Penjualan, Absensi & HR, Finance, Stok & Distribusi, Sistem)
# 2. MCP marcom (Jadwal Konten, KOL, Endorsement, Ads Budget, Promo, Menu)
# 3. Sinkronisasi SOUL-ceo.md terbaru ke ~/.hermes/profiles/ceo/SOUL.md
# 4. Restart gateway & verifikasi daftar alat terpasang
#
# Penggunaan di VPS Hostinger (user suka-hermes):
#   ./scripts/hermes/hubungkan-semua-app-ceo.sh
#   ./scripts/hermes/hubungkan-semua-app-ceo.sh --marcom-key "<kunci-marcom-mcp>"
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

echo -e "\n${BOLD}${BIRU}======================================================${NC}"
echo -e "${BOLD}${BIRU}   KONEKSI SEMUA APLIKASI & MCP KE BOT CEO (HERMES)  ${NC}"
echo -e "${BOLD}${BIRU}======================================================${NC}\n"

USER_SEKARANG=$(id -un || whoami)
if [[ "$USER_SEKARANG" == "root" ]]; then
  log_err "Jangan jalankan skrip ini sebagai root!"
  echo "Jalankan sebagai user suka-hermes:"
  echo "  su - suka-hermes"
  echo "  $0"
  exit 1
fi

CEO_DIR="$HOME/.hermes/profiles/ceo"
CONFIG_FILE="$CEO_DIR/config.yaml"
ENV_FILE="$CEO_DIR/.env"
MARCOM_DIR="$HOME/.hermes/profiles/marcom"

if [[ ! -d "$CEO_DIR" ]]; then
  log_err "Direktori profil CEO tidak ditemukan di $CEO_DIR"
  exit 1
fi

# 1. Parsing argumen opsional --marcom-key
MARCOM_KEY_INPUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --marcom-key)
      MARCOM_KEY_INPUT="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# 2. Cek & Siapkan Kunci MCP Marcom
log_info "1. Memeriksa kunci MCP Marcom di profil CEO..."
if grep -q '^MARCOM_MCP_KEY=' "$ENV_FILE" 2>/dev/null; then
  log_ok "Kunci MARCOM_MCP_KEY sudah terdaftar di $ENV_FILE"
else
  KUNCI_DITEMUKAN=""
  if [[ -n "$MARCOM_KEY_INPUT" ]]; then
    KUNCI_DITEMUKAN="$MARCOM_KEY_INPUT"
  elif [[ -f "$MARCOM_DIR/.env" ]]; then
    log_info "Mencari kunci di profil marcom ($MARCOM_DIR/.env)..."
    KUNCI_DITEMUKAN=$(grep -E '^(MARCOM_MCP_KEY|HERMES_MARCOM_API_KEY)=' "$MARCOM_DIR/.env" | head -n1 | cut -d= -f2- || true)
    if [[ -z "$KUNCI_DITEMUKAN" ]]; then
      # Coba nama variabel lain di profil marcom
      KUNCI_DITEMUKAN=$(grep -E '^(SUKA_MCP_KEY|MCP_KEY)=' "$MARCOM_DIR/.env" | head -n1 | cut -d= -f2- || true)
    fi
  fi

  if [[ -n "$KUNCI_DITEMUKAN" ]]; then
    echo "MARCOM_MCP_KEY=$KUNCI_DITEMUKAN" >> "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log_ok "Berhasil menambahkan MARCOM_MCP_KEY ke $ENV_FILE"
  else
    log_warn "Kunci MCP Marcom belum ditemukan otomatis."
    echo -n "Masukkan HERMES_MARCOM_API_KEY (dari Coolify apps/marcom): "
    read -r INPUT_MANUAL
    if [[ -n "$INPUT_MANUAL" ]]; then
      echo "MARCOM_MCP_KEY=$INPUT_MANUAL" >> "$ENV_FILE"
      chmod 600 "$ENV_FILE"
      log_ok "Berhasil menambahkan MARCOM_MCP_KEY ke $ENV_FILE"
    else
      log_err "Kunci Marcom tidak boleh kosong untuk mengaktifkan MCP marcom."
    fi
  fi
fi

# 3. Konfigurasi config.yaml (Tambahkan mcp_servers.marcom jika belum ada)
log_info "2. Memeriksa konfigurasi MCP Server di $CONFIG_FILE..."
if grep -q 'marcom:' "$CONFIG_FILE" 2>/dev/null; then
  log_ok "Server MCP 'marcom' sudah terdaftar di $CONFIG_FILE"
else
  log_info "Menambahkan server MCP 'marcom' ke $CONFIG_FILE..."
  # Backup config.yaml
  cp "$CONFIG_FILE" "$CONFIG_FILE.bak.$(date +%s)"

  # Jika belum ada blok mcp_servers: sama sekali
  if ! grep -q 'mcp_servers:' "$CONFIG_FILE"; then
    cat >> "$CONFIG_FILE" << 'EOF'

mcp_servers:
  suka:
    url: "https://admin.sukashawarma.com/api/hermes/mcp"
    headers:
      Authorization: "Bearer ${SUKA_MCP_KEY}"
    enabled: true
  marcom:
    url: "https://marcom.sukashawarma.com/api/hermes/mcp"
    headers:
      Authorization: "Bearer ${MARCOM_MCP_KEY}"
    enabled: true
EOF
  else
    # Tambahkan blok marcom di dalam mcp_servers
    cat >> "$CONFIG_FILE" << 'EOF'
  marcom:
    url: "https://marcom.sukashawarma.com/api/hermes/mcp"
    headers:
      Authorization: "Bearer ${MARCOM_MCP_KEY}"
    enabled: true
EOF
  fi
  log_ok "Server MCP 'marcom' berhasil ditambahkan ke $CONFIG_FILE"
fi

# 4. Sinkronisasi SOUL-ceo.md Terbaru
log_info "3. Memperbarui persona & panduan data SOUL.md Bot CEO..."
REPO_DIR="$HOME/DIGITALISASI-SS-PROJECT"
SOUL_RAW_URL="https://raw.githubusercontent.com/dev-sukashawarma/DIGITALISASI-SS-PROJECT/main/docs/hermes/SOUL-ceo.md"

if [[ -f "$REPO_DIR/docs/hermes/SOUL-ceo.md" ]]; then
  sed '/^<!--/d' "$REPO_DIR/docs/hermes/SOUL-ceo.md" > "$CEO_DIR/SOUL.md"
  log_ok "SOUL.md diperbarui dari repositori lokal ($REPO_DIR)."
else
  log_info "Mengunduh SOUL-ceo.md terbaru dari GitHub..."
  if curl -fsSL "$SOUL_RAW_URL" | sed '/^<!--/d' > "$CEO_DIR/SOUL.md"; then
    log_ok "SOUL.md berhasil diunduh dan dipasang ke $CEO_DIR/SOUL.md"
  else
    log_warn "Gagal mengunduh SOUL-ceo.md otomatis; pastikan sinkron-soul timer berjalan."
  fi
fi

# 5. Restart hermes-gateway
log_info "4. Me-restart hermes-gateway..."
systemctl --user restart hermes-gateway
sleep 3
log_ok "hermes-gateway berhasil direstart."

# 6. Verifikasi Alat yang Terpasang
echo -e "\n${BOLD}${HIJAU}======================================================${NC}"
echo -e "${BOLD}${HIJAU}   VERIFIKASI ALAT TERPASANG UNTUK BOT CEO           ${NC}"
echo -e "${BOLD}${HIJAU}======================================================${NC}\n"

if command -v hermes &>/dev/null; then
  log_info "Daftar alat MCP untuk profil CEO:"
  hermes -p ceo tools --summary || true
else
  log_warn "Perintah hermes CLI tidak ditemukan di PATH; lewati verifikasi CLI."
fi

echo -e "\n${BOLD}${BIRU}Selesai!${NC} Bot CEO kini terhubung ke seluruh sistem:"
echo "1. Server MCP 'suka': Penjualan, Absensi/HR, Finance, Stok & Distribusi, Sistem"
echo "2. Server MCP 'marcom': Konten, KOL & Endorsement, Ads Budget, Iklan, Promo, Menu"
echo "Silakan coba tanyakan langsung di Telegram ke bot Agent SukaShawarma:"
echo '  "Bagaimana status stok sapi dan saos cabe saat ini?"'
echo '  "Coba cek jadwal konten dan sisa budget ads marcom bulan ini"'
echo '  "Bagaimana status sistem operasional hari ini?"'
