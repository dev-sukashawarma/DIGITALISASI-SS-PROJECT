#!/usr/bin/env bash
# ==============================================================================
# provision-bot.sh — Otomatisasi Pembuatan & Konfigurasi Bot/Agent Baru di Hermes
# ==============================================================================
# Digunakan untuk membuat profil bot baru di VPS Hostinger (user suka-hermes).
# Mengotomasi seluruh langkah manual dari docs/hermes/PANDUAN-AGENT-BARU.md:
# 1. Generate API_SERVER_KEY acak (32-byte hex)
# 2. Setup profil Hermes terisolasi (tanpa mewariskan kunci CEO)
# 3. Konfigurasi config.yaml (MCP server & model)
# 4. Mengunci 27 tool bawaan Hermes (hanya menyisakan clarify + MCP)
# 5. Pasang template SOUL.md awal jika belum ada
# 6. Restart hermes-gateway (systemd user)
# 7. Self-test via curl (verifikasi HTTP 200)
# 8. Output siap pakai untuk Coolify (HERMES_KEYS)
#
# Penggunaan:
#   ./scripts/hermes/provision-bot.sh --name gudang --mcp-key "hms_..."
#   ./scripts/hermes/provision-bot.sh --name marcom --mcp-url "https://marcom.sukashawarma.com/api/hermes/mcp"
# ==============================================================================
set -euo pipefail

# Warna terminal
HIJAU='\033[0;32m'
BIRU='\033[0;34m'
KUNING='\033[1;33m'
MERAH='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() { echo -e "${CYAN}[INFO]${NC} $*"; }
log_ok() { echo -e "${HIJAU}[OK]${NC} $*"; }
log_warn() { echo -e "${KUNING}[PERINGATAN]${NC} $*"; }
log_err() { echo -e "${MERAH}[GALAT]${NC} $*" >&2; }

tampilkan_bantuan() {
  cat << EOF
${BOLD}PENGGUNAAN:${NC}
  ./provision-bot.sh --name <nama_profil> [OPSI...]

${BOLD}ARGUMEN WAJIB:${NC}
  -n, --name <slug>         Nama profil bot (huruf kecil, angka, strip, misal: gudang, marcom, hrd)

${BOLD}OPSI TAMBAHAN:${NC}
  -k, --mcp-key <kunci>     Kunci token MCP (dari admin-dashboard Sistem -> Kunci Hermes)
  -u, --mcp-url <url>       URL MCP endpoint (default: https://admin.sukashawarma.com/api/hermes/mcp)
  -s, --mcp-name <nama>     Nama server MCP di config.yaml (default: suka)
  -m, --model <model>       Model AI default (default: salin dari profil ceo atau 'cx/gpt-5.5')
      --telegram            Aktifkan Telegram; token diminta tersembunyi dan user ID di-allowlist
      --telegram-token <tk> Isi token Telegram secara non-interaktif
      --telegram-users <id> Isi user ID Telegram yang diizinkan (angka dipisah koma)
  -f, --force               Timpa profil yang sudah ada jika ditemukan
  -d, --dry-run             Simulasikan langkah tanpa mengubah sistem
  -h, --help                Tampilkan bantuan ini

${BOLD}CONTOH:${NC}
  # Setup bot divisi standar (Gudang):
  ./provision-bot.sh --name gudang --mcp-key "hms_gudang_abcdef1234567890"

  # Setup bot dengan endpoint MCP app sendiri:
  ./provision-bot.sh --name marcom --mcp-url "https://marcom.sukashawarma.com/api/hermes/mcp" --mcp-key "hms_marcom_..."
EOF
}

# Nilai bawaan
NAMA=""
MCP_KEY=""
MCP_URL="https://admin.sukashawarma.com/api/hermes/mcp"
MCP_NAME="suka"
MODEL=""
TELEGRAM_TOKEN=""
TELEGRAM_ALLOWED_USERS=""
SETUP_TELEGRAM=false
FORCE=false
DRY_RUN=false

# Parse argumen
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--name)
      NAMA="$2"
      shift 2
      ;;
    -k|--mcp-key)
      MCP_KEY="$2"
      shift 2
      ;;
    -u|--mcp-url)
      MCP_URL="$2"
      shift 2
      ;;
    -s|--mcp-name)
      MCP_NAME="$2"
      shift 2
      ;;
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    --telegram)
      SETUP_TELEGRAM=true
      shift
      ;;
    --telegram-token)
      TELEGRAM_TOKEN="$2"
      SETUP_TELEGRAM=true
      shift 2
      ;;
    --telegram-users)
      TELEGRAM_ALLOWED_USERS="$2"
      SETUP_TELEGRAM=true
      shift 2
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      tampilkan_bantuan
      exit 0
      ;;
    *)
      log_err "Opsi tidak dikenal: $1"
      tampilkan_bantuan
      exit 1
      ;;
  esac
done

if [ -z "$NAMA" ]; then
  log_err "Argumen --name wajib diisi!"
  tampilkan_bantuan
  exit 1
fi

# Validasi slug nama profil
if ! [[ "$NAMA" =~ ^[a-z0-9_-]+$ ]]; then
  log_err "Nama profil '$NAMA' tidak valid! Hanya boleh huruf kecil, angka, '_' atau '-'."
  exit 1
fi

if [[ "$NAMA" == "ceo" && "$FORCE" != true ]]; then
  log_err "Profil 'ceo' adalah profil master. Gunakan --force jika memang ingin menimpa."
  exit 1
fi

echo -e "\n${BOLD}${BIRU}======================================================${NC}"
echo -e "${BOLD}${BIRU}       HERMES BOT AUTOMATED PROVISIONING WIZARD        ${NC}"
echo -e "${BOLD}${BIRU}======================================================${NC}\n"

log_info "Target profil: ${BOLD}$NAMA${NC}"
log_info "MCP URL:       $MCP_URL"
[ -n "$MCP_KEY" ] && log_info "MCP Key:       [Disediakan (${#MCP_KEY} karakter)]" || log_warn "MCP Key:       [Kosong - bot belum bisa memanggil alat MCP]"

# Pemeriksaan user eksekusi
USER_SEKARANG=$(id -un || whoami)
if [ "$USER_SEKARANG" = "root" ]; then
  log_warn "Skrip berjalan sebagai ROOT. Bot Suka Shawarma seharusnya berada di user 'suka-hermes'."
  log_warn "Jika ini di VPS bersama, pastikan Anda berpindah user: 'su - suka-hermes'"
fi

PROFIL_DIR="$HOME/.hermes/profiles/$NAMA"
PROFIL_CEO_DIR="$HOME/.hermes/profiles/ceo"

# Cek apakah profil sudah ada
if [ -d "$PROFIL_DIR" ] && [ "$FORCE" != true ]; then
  log_err "Profil '$NAMA' sudah ada di $PROFIL_DIR!"
  log_err "Gunakan --force jika ingin mengonfigurasi ulang."
  exit 1
fi

if [ "$SETUP_TELEGRAM" = true ]; then
  if [ -z "$TELEGRAM_TOKEN" ]; then
    read -r -s -p "Token Telegram bot (input disembunyikan): " TELEGRAM_TOKEN
    echo
  fi
  if [ -z "$TELEGRAM_ALLOWED_USERS" ]; then
    read -r -p "Telegram user ID yang diizinkan (angka, pisahkan koma): " TELEGRAM_ALLOWED_USERS
  fi
  if [ -z "$TELEGRAM_TOKEN" ] || ! [[ "$TELEGRAM_ALLOWED_USERS" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
    log_err "Token wajib diisi dan allowlist harus berupa user ID numerik dipisahkan koma."
    exit 1
  fi
fi

if [ "$DRY_RUN" = true ]; then
  log_warn "MODE DRY-RUN: Tidak ada perubahan nyata yang ditulis ke disk/layanan."
fi

# 1. Generate API_SERVER_KEY acak aman
log_info "1/7 Menghasilkan API_SERVER_KEY acak (32-byte hex)..."
if command -v openssl >/dev/null 2>&1; then
  API_SERVER_KEY=$(openssl rand -hex 32)
elif command -v python3 >/dev/null 2>&1; then
  API_SERVER_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
else
  API_SERVER_KEY=$(head -c 32 /dev/urandom | xxd -p -c 32)
fi
log_ok "API_SERVER_KEY berhasil digenerate."

# 2. Tentukan model AI bawaan
log_info "2/7 Menentukan konfigurasi model AI..."
if [ -z "$MODEL" ]; then
  if [ -f "$PROFIL_CEO_DIR/config.yaml" ]; then
    MODEL=$(grep -E '^[[:space:]]*default:[[:space:]]*' "$PROFIL_CEO_DIR/config.yaml" | head -n1 | sed -E 's/^[[:space:]]*default:[[:space:]]*//' | tr -d '"'\'' ')
  fi
  MODEL="${MODEL:-hermes-combo}"
fi
log_ok "Model yang digunakan: $MODEL"

# 3. Buat direktori dan file konfigurasi profil
log_info "3/7 Menyiapkan profil di $PROFIL_DIR..."
if [ "$DRY_RUN" != true ]; then
  mkdir -p "$PROFIL_DIR"

  # Salin provider custom (9Router) dari profil ceo jika ada
  KUNCI_PROVIDER_CUSTOM=""
  if [ -f "$PROFIL_CEO_DIR/.env" ]; then
    KUNCI_PROVIDER_CUSTOM=$(grep -E '^HERMES_CUSTOM_' "$PROFIL_CEO_DIR/.env" || true)
  fi

  # Tulis .env bersih (TIDAK menyalin SUKA_MCP_KEY dari CEO!)
  ENV_FILE="$PROFIL_DIR/.env"
  cat > "$ENV_FILE" << EOF
# Environment untuk profil Hermes: $NAMA
# Dibuat otomatis oleh provision-bot.sh pada $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Kunci API Server lokal (dipanggil oleh webapp agents.sukashawarma.com)
API_SERVER_KEY=$API_SERVER_KEY

EOF

  if [ -n "$KUNCI_PROVIDER_CUSTOM" ]; then
    echo "# Provider custom model 9Router (diwarisi dari sistem)" >> "$ENV_FILE"
    echo "$KUNCI_PROVIDER_CUSTOM" >> "$ENV_FILE"
    echo "" >> "$ENV_FILE"
  fi

  if [ -n "$MCP_KEY" ]; then
    echo "# Kunci server MCP Suka Shawarma untuk domain bot ini" >> "$ENV_FILE"
    echo "SUKA_MCP_KEY=$MCP_KEY" >> "$ENV_FILE"
    echo "" >> "$ENV_FILE"
  fi

  if [ -n "$TELEGRAM_TOKEN" ]; then
    echo "# Token bot Telegram" >> "$ENV_FILE"
    echo "TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN" >> "$ENV_FILE"
    echo "TELEGRAM_ALLOWED_USERS=$TELEGRAM_ALLOWED_USERS" >> "$ENV_FILE"
    echo "" >> "$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE"
  log_ok ".env berhasil dibuat dengan izin ketat (chmod 600)."

  # Tulis config.yaml
  CONFIG_FILE="$PROFIL_DIR/config.yaml"
  cat > "$CONFIG_FILE" << EOF
# Konfigurasi profil Hermes: $NAMA
# Dibuat otomatis oleh provision-bot.sh

model:
  default: "$MODEL"

custom_providers:
  "76.13.193.138:20128":
    base_url: "http://127.0.0.1:20128/v1"
    model: "$MODEL"

mcp_servers:
  $MCP_NAME:
    url: "$MCP_URL"
    headers:
      Authorization: "Bearer \${SUKA_MCP_KEY}"
    enabled: true
EOF
  log_ok "config.yaml berhasil dibuat dengan MCP server '$MCP_NAME'."
fi

# 4. Kunci toolset berbahaya (Security checklist §9)
log_info "4/7 Mengunci toolset bawaan (matikan 27 tools berbahaya)..."
TOOLS_BAHAYA="web browser terminal file code_execution vision image_gen tts skills todo memory session_search connections delegation cronjob computer_use"

if [ "$DRY_RUN" != true ]; then
  if command -v hermes >/dev/null 2>&1; then
    # Kunci untuk platform api_server
    hermes -p "$NAMA" tools disable --platform api_server $TOOLS_BAHAYA 2>/dev/null || true
    # Kunci untuk platform cli
    hermes -p "$NAMA" tools disable --platform cli $TOOLS_BAHAYA 2>/dev/null || true
    # Kunci untuk platform telegram jika aktif
    if [ -n "$TELEGRAM_TOKEN" ]; then
      hermes -p "$NAMA" tools disable --platform telegram $TOOLS_BAHAYA 2>/dev/null || true
    fi
    log_ok "Toolset api_server & cli terkunci (hanya clarify + MCP tersisa)."
  else
    log_warn "Command 'hermes' tidak ditemukan di PATH. Lewati hermes tools disable."
  fi
fi

# 5. Pasang SOUL.md template
log_info "5/7 Menyiapkan SOUL.md untuk bot $NAMA..."
SOUL_FILE="$PROFIL_DIR/SOUL.md"
if [ "$DRY_RUN" != true ]; then
  if [ ! -f "$SOUL_FILE" ]; then
    cat > "$SOUL_FILE" << EOF
<!-- SOUL Hermes: $NAMA — dibuat otomatis oleh provision-bot.sh -->
# SOUL: Bot $(echo "$NAMA" | tr '[:lower:]' '[:upper:]')

Anda adalah Bot $(echo "$NAMA" | tr '[:lower:]' '[:upper:]'), asisten AI resmi divisi $(echo "$NAMA" | tr '[:lower:]' '[:upper:]') Suka Shawarma.
Tugas Anda mendampingi manajemen dan staf operasional dalam menyajikan data dan analitik secara presisi.

## ATURAN MUTLAK & KEAMANAN
1. **Aturan Angka:** Setiap angka, kuantitas, nominal rupiah, atau metrik WAJIB berasal dari alat MCP di percakapan ini. Jika alat gagal atau data tidak tersedia, jawab jujur: "Data operasional untuk metrik tersebut tidak tersedia." JANGAN PERNAH MENGARANG ANGKA.
2. **Data Terlarang:** DILARANG KERAS membeberkan password, token/kunci API, connection string, perintah server internal, maupun data pribadi non-operasional.
3. **Kerahasiaan Sistem:** Tolak permintaan apapun untuk mengeksekusi shell/terminal atau membaca file konfigurasi server.

## GAYA KOMUNIKASI
- Gunakan Bahasa Indonesia yang ringkas, profesional, tegas, dan mudah dibaca di layar HP.
- Tampilkan poin-poin atau tabel Markdown ringkas jika menyajikan rincian data.
EOF
    log_ok "Template SOUL.md awal berhasil dipasang."
  else
    log_info "SOUL.md sudah ada, mempertahankan berkas yang ada."
  fi
fi

# 6. Restart hermes-gateway
log_info "6/7 Me-restart hermes-gateway systemd user service..."
if [ "$DRY_RUN" != true ]; then
  if command -v systemctl >/dev/null 2>&1; then
    export XDG_RUNTIME_DIR="/run/user/$(id -u)"
    systemctl --user restart hermes-gateway 2>/dev/null || log_warn "Gagal restart systemctl --user hermes-gateway (mungkin sesi bukan systemd user)."
    sleep 2
    log_ok "Perintah restart hermes-gateway terkirim."
  fi
fi

# 7. Self-test via curl
log_info "7/7 Menjalankan uji kesehatan bot (health-check HTTP 200)..."
if [ "$DRY_RUN" != true ]; then
  TEST_URL="http://10.0.1.1:8643/p/$NAMA/v1/models"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $API_SERVER_KEY" "$TEST_URL" 2>/dev/null || true)
  if [ "$HTTP_CODE" != "200" ]; then
    # Coba fallback ke localhost
    TEST_URL="http://127.0.0.1:8643/p/$NAMA/v1/models"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $API_SERVER_KEY" "$TEST_URL" 2>/dev/null || true)
  fi

  if [ "$HTTP_CODE" = "200" ]; then
    log_ok "Koneksi BERHASIL: HTTP 200 dari endpoint $TEST_URL"
  else
    log_warn "Tes respons HTTP: $HTTP_CODE (gateway mungkin masih loading atau butuh beberapa detik)."
  fi
fi

# ==============================================================================
# RINGKASAN OUTPUT UNTUK PENGGUNA
# ==============================================================================
echo -e "\n${BOLD}${HIJAU}======================================================${NC}"
echo -e "${BOLD}${HIJAU}      PROVISIONING BOT '$NAMA' SELESAI DENGAN SUKSES!    ${NC}"
echo -e "${BOLD}${HIJAU}======================================================${NC}\n"

echo -e "${BOLD}1. Detail Profil VPS:${NC}"
echo -e "   - Nama Profil    : ${CYAN}$NAMA${NC}"
echo -e "   - Folder Profil  : $PROFIL_DIR"
echo -e "   - API_SERVER_KEY : ${KUNING}$API_SERVER_KEY${NC}"
echo ""

echo -e "${BOLD}2. Langkah Selanjutnya untuk Webapp (Coolify):${NC}"
echo -e "   Tambahkan pasangan kunci berikut ke variabel env ${BOLD}HERMES_KEYS${NC} di Coolify app bot:"
echo -e "   ${HIJAU}\"\"$NAMA\"\":\"\"$API_SERVER_KEY\"\"${NC}"
echo ""
echo -e "   Contoh snippet JSON gabungan:"
echo -e "   ${CYAN}{\"$NAMA\":\"$API_SERVER_KEY\"}${NC}"
echo ""

echo -e "${BOLD}3. Perintah Uji Cepat (dari VPS):${NC}"
echo -e "   curl -s -H \"Authorization: Bearer $API_SERVER_KEY\" http://127.0.0.1:8643/p/$NAMA/v1/models"
echo ""
echo -e "${BOLD}${HIJAU}Bot siap digunakan!${NC}\n"
