#!/usr/bin/env python3
"""
==============================================================================
kirim-laporan-telegram.py — Pengirim Laporan Otomatis Suka Shawarma ke Telegram
==============================================================================
Mengambil data laporan terverifikasi dari server MCP Suka Shawarma dan
mengirimkannya langsung ke Grup Telegram Owner / Manajemen melalui Telegram Bot API.

Keunggulan:
- Pesan bersih & profesional tanpa embel-embel footer "Cronjob Response" dari Hermes.
- Menggunakan token bot Telegram yang sudah ada di VPS / profil.
- Otomatis membaca konfigurasi dari ~/.hermes/profiles/ceo/.env atau environment.
- Mendukung jenis laporan: pagi (omzet kemarin), malam (closing), dan absensi (kru).

Penggunaan:
  python3 kirim-laporan-telegram.py --jenis pagi
  python3 kirim-laporan-telegram.py --jenis malam
  python3 kirim-laporan-telegram.py --jenis absensi
  python3 kirim-laporan-telegram.py --jenis test --chat-id "<ID_GRUP>"
  python3 kirim-laporan-telegram.py --jenis pagi --dry-run
==============================================================================
"""

import argparse
import datetime
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_MCP_URL = "https://admin.sukashawarma.com/api/hermes/mcp"

# Pencarian otomatis file .env
ENV_PATHS = [
    pathlib.Path(os.environ.get("HERMES_HOME", "")) / ".env" if os.environ.get("HERMES_HOME") else None,
    pathlib.Path.home() / ".hermes" / "profiles" / "ceo" / ".env",
    pathlib.Path.home() / ".hermes" / ".env",
    pathlib.Path.cwd() / ".env",
    pathlib.Path(__file__).resolve().parent.parent.parent / ".env",
]

def muat_env_file(path_file: pathlib.Path) -> dict:
    env = {}
    if not path_file or not path_file.is_file():
        return env
    try:
        for baris in path_file.read_text(encoding="utf-8").splitlines():
            baris = baris.strip()
            if not baris or baris.startswith("#"):
                continue
            if "=" in baris:
                k, v = baris.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    except Exception:
        pass
    return env

def kumpulkan_konfigurasi(custom_env_file=None) -> dict:
    konfigurasi = {}
    # 1. Dari file env terdeteksi
    if custom_env_file:
        konfigurasi.update(muat_env_file(pathlib.Path(custom_env_file)))
    else:
        for p in reversed(ENV_PATHS):
            if p and p.is_file():
                konfigurasi.update(muat_env_file(p))

    # 2. Dari OS environment (prioritas tertinggi)
    for k in ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_OWNER_CHAT_ID", "TELEGRAM_HOME_CHANNEL", "SUKA_MCP_KEY", "SUKA_MCP_URL"]:
        if os.environ.get(k):
            konfigurasi[k] = os.environ[k]

    return konfigurasi

def panggil_mcp(mcp_url: str, mcp_key: str, nama_alat: str, argumen: dict = None) -> str:
    """Memanggil alat MCP Suka Shawarma via JSON-RPC 2.0 dan mengembalikan isi teks."""
    if argumen is None:
        argumen = {}
    badan = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": nama_alat,
            "arguments": argumen
        }
    }
    data_bytes = json.dumps(badan).encode("utf-8")
    req = urllib.request.Request(
        mcp_url,
        data=data_bytes,
        headers={
            "Authorization": f"Bearer {mcp_key}",
            "Content-Type": "application/json",
            "User-Agent": "suka-telegram-reporter/1.0",
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            hasil_raw = json.load(resp)
    except urllib.error.HTTPError as e:
        pesan_err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} dari MCP ({mcp_url}): {pesan_err}")
    except Exception as e:
        raise RuntimeError(f"Gagal koneksi ke MCP ({mcp_url}): {e}")

    if hasil_raw.get("error"):
        raise RuntimeError(f"Galat MCP: {hasil_raw['error']}")

    result = hasil_raw.get("result", {})
    if result.get("isError"):
        teks_err = result.get("content", [{}])[0].get("text", "Galat pada alat MCP")
        raise RuntimeError(f"Alat MCP gagal: {teks_err}")

    content = result.get("content", [])
    if not content or "text" not in content[0]:
        raise RuntimeError("Format kembalian MCP tidak sesuai (content kosong)")

    isi_json = json.loads(content[0]["text"])
    teks = isi_json.get("teks")
    if not teks:
        raise RuntimeError(f"Alat '{nama_alat}' tidak mengembalikan field 'teks'")

    return teks

def kirim_ke_telegram(token: str, chat_id: str, pesan: str) -> bool:
    """Mengirim pesan langsung ke Telegram Bot API."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": pesan,
        "disable_web_page_preview": True,
    }
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "suka-telegram-bot/1.0",
        }
    )

    maks_coba = 3
    for percobaan in range(1, maks_coba + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                hasil = json.load(resp)
                if hasil.get("ok"):
                    return True
                else:
                    print(f"⚠️ Telegram API mengembalikan error: {hasil}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"⚠️ HTTP {e.code} Telegram API: {err_body}", file=sys.stderr)
            # Jika chat ID salah atau bot belum join grup, jangan retry
            if e.code in [400, 401, 403]:
                return False
        except Exception as e:
            print(f"⚠️ Percobaan {percobaan}/{maks_coba} gagal koneksi ke Telegram: {e}", file=sys.stderr)

        if percobaan < maks_coba:
            time.sleep(2 * percobaan)

    return False

def periksa_chat_id(token: str) -> None:
    """Mengambil riwayat update Telegram untuk menemukan Chat ID grup."""
    if not token:
        print("❌ Galat: TELEGRAM_BOT_TOKEN tidak ditemukan di .env maupun opsi --token.", file=sys.stderr)
        sys.exit(1)

    url = f"https://api.telegram.org/bot{token}/getUpdates"
    req = urllib.request.Request(url, headers={"User-Agent": "suka-telegram-bot/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        print(f"❌ HTTP {e.code} dari Telegram API: {err_msg}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Gagal menghubungi Telegram API: {e}", file=sys.stderr)
        sys.exit(1)

    if not data.get("ok"):
        print(f"❌ Respons Telegram API tidak sukses: {data}", file=sys.stderr)
        sys.exit(1)

    hasil = data.get("result", [])
    if not hasil:
        print("\nℹ️  Belum ada update/pesan baru yang masuk ke bot Telegram.")
        print("👉 Silakan kirim 1 pesan teks (misal: 'halo') di grup Telegram Anda, lalu jalankan kembali perintah ini.\n")
        return

    obrolan_terdeteksi = {}
    for item in hasil:
        pesan = item.get("message") or item.get("channel_post") or item.get("my_chat_member", {}).get("chat") or {}
        chat = pesan.get("chat") if isinstance(pesan, dict) and "chat" in pesan else pesan
        if isinstance(chat, dict) and "id" in chat:
            cid = chat["id"]
            if cid not in obrolan_terdeteksi:
                obrolan_terdeteksi[cid] = {
                    "id": cid,
                    "type": chat.get("type", "unknown"),
                    "title": chat.get("title") or chat.get("first_name", "Tanpa Judul"),
                    "username": chat.get("username", "-")
                }

    print("\n======================================================")
    print("      DAFTAR CHAT / GRUP TELEGRAM YANG TERDETEKSI     ")
    print("======================================================\n")
    for cid, info in obrolan_terdeteksi.items():
        print(f"📌 Chat ID   : {info['id']}")
        print(f"   Nama/Judul: {info['title']}")
        print(f"   Tipe      : {info['type']}")
        print(f"   Username  : @{info['username']}")
        print("-" * 50)

    print("\n💡 Masukkan Chat ID yang sesuai ke ~/.hermes/profiles/ceo/.env:")
    print("   TELEGRAM_CHAT_ID=<Chat ID di atas>")
    print("======================================================\n")

def main():
    parser = argparse.ArgumentParser(description="Kirim Laporan Suka Shawarma ke Telegram")
    parser.add_argument(
        "-j", "--jenis",
        choices=["pagi", "malam", "absensi", "test"],
        help="Jenis laporan yang akan dikirim: 'pagi' (penjualan kemarin), 'malam' (closing omzet), 'absensi' (kehadiran kru), atau 'test' (uji koneksi)"
    )
    parser.add_argument("-c", "--chat-id", help="Chat ID Telegram (contoh: -100xxxxxxxxxx untuk grup). Mengabaikan .env jika diisi.")
    parser.add_argument("-t", "--token", help="Bot Token Telegram dari @BotFather. Mengabaikan .env jika diisi.")
    parser.add_argument("-d", "--tanggal", help="Tanggal laporan (YYYY-MM-DD). Default otomatis.")
    parser.add_argument("--mcp-url", help=f"URL MCP Server. Default: {DEFAULT_MCP_URL}")
    parser.add_argument("--mcp-key", help="Kunci MCP (SUKA_MCP_KEY). Mengabaikan .env jika diisi.")
    parser.add_argument("--env-file", help="Path spesifik ke file .env.")
    parser.add_argument("--cek-chat-id", action="store_true", help="Cek daftar Chat ID grup dari getUpdates Telegram Bot")
    parser.add_argument("--dry-run", action="store_true", help="Cetak isi laporan ke terminal tanpa mengirim ke Telegram.")
    parser.add_argument("--silent", action="store_true", help="Jangan cetak output status jika berhasil.")

    args = parser.parse_args()

    # Kumpulkan config
    konfig = kumpulkan_konfigurasi(args.env_file)
    token = args.token or konfig.get("TELEGRAM_BOT_TOKEN")

    # Mode Cek Chat ID
    if args.cek_chat_id:
        periksa_chat_id(token)
        sys.exit(0)

    if not args.jenis:
        parser.print_help()
        sys.exit(1)

    chat_id = (
        args.chat_id
        or konfig.get("TELEGRAM_OWNER_CHAT_ID")
        or konfig.get("TELEGRAM_CHAT_ID")
        or konfig.get("TELEGRAM_HOME_CHANNEL")
        or (konfig.get("TELEGRAM_ALLOWED_USERS", "").split(",")[0].strip() or None)
    )
    mcp_key = args.mcp_key or konfig.get("SUKA_MCP_KEY")
    mcp_url = args.mcp_url or konfig.get("SUKA_MCP_URL") or DEFAULT_MCP_URL

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Mode Uji (Test)
    if args.jenis == "test":
        if not token:
            print("❌ Galat: TELEGRAM_BOT_TOKEN tidak ditemukan di .env maupun argumen --token", file=sys.stderr)
            sys.exit(1)
        if not chat_id:
            print("❌ Galat: Chat ID Telegram tidak ditemukan di .env maupun argumen --chat-id", file=sys.stderr)
            sys.exit(1)
        
        pesan_uji = (
            "🤖 <b>Uji Koneksi Bot Suka Shawarma</b>\n\n"
            f"✅ Bot Telegram berhasil mengirim pesan langsung ke grup ini.\n"
            f"🕒 Waktu server: {now_str}\n"
            "Status: Siap menerima jadwal pengiriman laporan otomatis (Cron Job)."
        )
        if args.dry_run:
            print("[DRY-RUN] Pesan yang akan dikirim:")
            print(pesan_uji)
            sys.exit(0)

        sukses = kirim_ke_telegram(token, chat_id, pesan_uji)
        if sukses:
            print(f"[{now_str}] ✅ Berhasil mengirim pesan uji koneksi ke Telegram ({chat_id})")
            sys.exit(0)
        else:
            print(f"[{now_str}] ❌ Gagal mengirim pesan uji koneksi ke Telegram ({chat_id})", file=sys.stderr)
            sys.exit(1)

    # 2. Mode Laporan Nyata (Pagi / Malam / Absensi)
    if not mcp_key:
        print("❌ Galat: SUKA_MCP_KEY tidak ditemukan di .env maupun argumen --mcp-key.", file=sys.stderr)
        print("   Pastikan kunci MCP sudah digenerate dari admin-dashboard Sistem -> Kunci Hermes.", file=sys.stderr)
        sys.exit(1)

    peta_alat = {
        "pagi": "laporan_pagi_ceo",
        "malam": "laporan_penutupan_malam",
        "absensi": "laporan_absensi_harian",
    }
    nama_alat = peta_alat[args.jenis]

    label_jenis = {
        "pagi": "Laporan Pagi Penjualan",
        "malam": "Laporan Penutupan Malam",
        "absensi": "Rekap Presensi Kru Operasional",
    }[args.jenis]

    argumen_alat = {}
    if args.tanggal:
        argumen_alat["tanggal"] = args.tanggal

    try:
        teks_laporan = panggil_mcp(mcp_url, mcp_key, nama_alat, argumen_alat)
    except Exception as e:
        print(f"[{now_str}] ❌ Galat saat mengambil {label_jenis}: {e}", file=sys.stderr)
        sys.exit(1)

    # Jika dry-run, cetak ke stdout lalu selesai
    if args.dry_run:
        print(f"--- [DRY-RUN: {label_jenis}] ---")
        print(teks_laporan)
        print("---------------------------------")
        sys.exit(0)

    # Validasi kredensial Telegram sebelum kirim
    if not token:
        print("❌ Galat: TELEGRAM_BOT_TOKEN tidak ditemukan. Harap isi di .env atau opsi --token.", file=sys.stderr)
        sys.exit(1)
    if not chat_id:
        print("❌ Galat: Target Chat ID Telegram belum diatur. Harap isi TELEGRAM_CHAT_ID di .env atau opsi --chat-id.", file=sys.stderr)
        sys.exit(1)

    # Kirim ke Telegram
    sukses = kirim_ke_telegram(token, chat_id, teks_laporan)
    if sukses:
        if not args.silent:
            print(f"[{now_str}] ✅ {label_jenis} berhasil dikirim ke Telegram ({chat_id})")
        sys.exit(0)
    else:
        print(f"[{now_str}] ❌ Gagal mengirim {label_jenis} ke Telegram ({chat_id})", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
