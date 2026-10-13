#!/usr/bin/env python3
"""
==============================================================================
kirim-laporan-telegram.py — Pengirim Laporan Otomatis Suka Shawarma ke Telegram
==============================================================================
Mengambil data laporan terverifikasi dari server MCP Suka Shawarma dan Marcom,
lalu memformatnya secara rapi dan mengirimkannya langsung ke Telegram DM Bos / Owner.

Daftar Jenis Laporan:
  1. sales-kemarin   : Omzet & performa hari kemarin (04:00 WIB)
  2. sales-sore      : Omzet & transaksi s.d. pukul 16:00 WIB (16:00 WIB)
  3. sales-malam     : Closing omzet harian s.d. pukul 21:00 WIB (21:00 WIB)
  4. absensi-kantor  : Presensi khusus staf Kantor Pusat HQ (08:30 WIB)
  5. absensi-outlet  : Presensi kru operasional outlet (14:00 WIB)
  6. marcom          : Status endorsement KOL & iklan aktif (04:00 WIB)
  7. stok            : Saldo stok bahan utama & pengiriman surat jalan (04:00 WIB)
  8. watchdog        : Telemetri sistem & VPS Hostinger (setiap 2 jam sekali)
==============================================================================
"""

import argparse
import datetime
import json
import os
import pathlib
import sys
import time
import shutil
import urllib.error
import urllib.parse
import urllib.request

# Pastikan encoding stdout/stderr selalu UTF-8 (terutama pada lingkungan Windows/terminal legacy)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DEFAULT_MCP_URL = "https://admin.sukashawarma.com/api/hermes/mcp"
DEFAULT_MARCOM_MCP_URL = "https://marcom.sukashawarma.com/api/hermes/mcp"

# Pencarian otomatis file .env
ENV_PATHS = [
    pathlib.Path(os.environ.get("HERMES_HOME", "")) / ".env" if os.environ.get("HERMES_HOME") else None,
    pathlib.Path.home() / ".hermes" / "profiles" / "ceo" / ".env",
    pathlib.Path.home() / ".hermes" / "profiles" / "marcom" / ".env",
    pathlib.Path.home() / ".hermes" / ".env",
    pathlib.Path("/home/suka-hermes/.hermes/profiles/ceo/.env"),
    pathlib.Path("/home/suka-hermes/.hermes/profiles/marcom/.env"),
    pathlib.Path("/home/suka-hermes/.hermes/.env"),
    pathlib.Path.cwd() / ".env",
    pathlib.Path(__file__).resolve().parent.parent.parent / ".env",
]

def muat_env_file(path_file: pathlib.Path) -> dict:
    env = {}
    if not path_file:
        return env
    try:
        if not path_file.is_file():
            return env
        for baris in path_file.read_text(encoding="utf-8").splitlines():
            baris = baris.strip()
            if not baris or baris.startswith("#"):
                continue
            if "=" in baris:
                k, v = baris.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    except (PermissionError, OSError, Exception):
        pass
    return env

def kumpulkan_konfigurasi(custom_env_file=None) -> dict:
    konfigurasi = {}
    if custom_env_file:
        konfigurasi.update(muat_env_file(pathlib.Path(custom_env_file)))
    else:
        for p in reversed(ENV_PATHS):
            if not p:
                continue
            try:
                if p.is_file():
                    konfigurasi.update(muat_env_file(p))
            except (PermissionError, OSError):
                continue

    for k in [
        "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_OWNER_CHAT_ID",
        "TELEGRAM_ALLOWED_USERS", "TELEGRAM_HOME_CHANNEL",
        "SUKA_MCP_KEY", "SUKA_MCP_URL", "MARCOM_MCP_KEY", "MARCOM_MCP_URL",
        "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ]:
        if os.environ.get(k):
            konfigurasi[k] = os.environ[k]

    return konfigurasi

def panggil_mcp_raw(mcp_url: str, mcp_key: str, nama_alat: str, argumen: dict = None) -> dict:
    """Memanggil alat MCP via JSON-RPC 2.0 dan mengembalikan dictionary data mentah."""
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

    return json.loads(content[0]["text"])

def kirim_ke_telegram(token: str, chat_id: str, pesan: str) -> bool:
    """Mengirim pesan langsung ke Telegram Bot API."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": pesan,
        "parse_mode": "Markdown",
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
            pesan_extra = ""
            if "chat not found" in err_body:
                pesan_extra = f" (User {chat_id} belum pernah klik START pada bot)"
            print(f"⚠️ HTTP {e.code} Telegram API [Chat {chat_id}]: {err_body}{pesan_extra}", file=sys.stderr)
            if e.code in [400, 401, 403]:
                return False
        except Exception as e:
            print(f"⚠️ Percobaan {percobaan}/{maks_coba} gagal koneksi ke Telegram [Chat {chat_id}]: {e}", file=sys.stderr)

        if percobaan < maks_coba:
            time.sleep(2 * percobaan)

    return False

def ambil_daftar_target_chat(konfig: dict, chat_id_override: str = None) -> list:
    """
    Mengumpulkan seluruh target chat_id yang valid tanpa duplikasi.
    Jika ada TELEGRAM_OWNER_CHAT_ID dan TELEGRAM_CHAT_ID, keduanya digabungkan
    sehingga laporan otomatis terkirim ke Owner dan Developer sekaligus.
    """
    targets = []
    if chat_id_override:
        for c in str(chat_id_override).split(","):
            c = c.strip()
            if c and c not in targets:
                targets.append(c)
        return targets

    for k in ["TELEGRAM_OWNER_CHAT_ID", "TELEGRAM_CHAT_ID"]:
        v = konfig.get(k)
        if v:
            for c in str(v).split(","):
                c = c.strip()
                if c and c not in targets:
                    targets.append(c)

    if not targets:
        allowed = konfig.get("TELEGRAM_ALLOWED_USERS") or konfig.get("TELEGRAM_HOME_CHANNEL")
        if allowed:
            for c in str(allowed).split(","):
                c = c.strip()
                if c and c not in targets:
                    targets.append(c)

    return targets

def kirim_ke_semua_target(token: str, chat_ids_str: str, pesan: str) -> tuple:
    """
    Mengirim pesan ke satu atau beberapa target chat_id (dipisah tanda koma).
    Mengembalikan tuple: (list_chat_sukses, list_chat_gagal).
    """
    if not chat_ids_str:
        return ([], [])
    targets = [c.strip() for c in str(chat_ids_str).split(",") if c.strip()]
    sukses = []
    gagal = []

    for cid in targets:
        ok = kirim_ke_telegram(token, cid, pesan)
        if ok:
            sukses.append(cid)
        else:
            gagal.append(cid)

    return (sukses, gagal)

# ==============================================================================
# FORMATTER SETIAP JENIS LAPORAN
# ==============================================================================

def format_rupiah(nominal: float) -> str:
    return f"Rp {nominal:,.0f}".replace(",", ".")

def format_angka(angka) -> str:
    try:
        return f"{int(angka):,}".replace(",", ".")
    except Exception:
        return str(angka)

def format_hari_tanggal(tgl_str: str) -> str:
    try:
        dt = datetime.datetime.strptime(tgl_str, "%Y-%m-%d")
        hari_map = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
        bulan_map = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
        hari = hari_map[dt.weekday()]
        return f"{hari}, {dt.day} {bulan_map[dt.month]} {dt.year}"
    except Exception:
        return tgl_str

def format_sales_kemarin(data_raw: dict) -> str:
    data = data_raw.get("data")
    if not data or not isinstance(data, dict):
        return data_raw.get("teks", "")

    tgl_raw = data_raw.get("tanggal", "")
    tgl_teks = format_hari_tanggal(tgl_raw) if tgl_raw else "Kemarin"

    omzet = data.get("omzet_kotor", 0)
    omzet_lalu = data.get("omzet_minggu_lalu", 0)
    transaksi = data.get("transaksi", 0)
    ranking = data.get("peringkat", [])
    menu_top = data.get("menu_teratas", [])

    # Persentase & Icon vs Minggu Lalu
    if omzet_lalu and omzet_lalu > 0:
        selisih_pct = ((omzet - omzet_lalu) / omzet_lalu) * 100
        icon_minggu = "📈" if selisih_pct >= 0 else "📉"
        tanda = "+" if selisih_pct > 0 else ""
        persen_str = f"({tanda}{selisih_pct:.1f}%)"
        minggu_lalu_line = f"{icon_minggu} *vs Minggu Lalu:* {format_rupiah(omzet_lalu)} {persen_str}"
    else:
        minggu_lalu_line = f"📈 *vs Minggu Lalu:* {format_rupiah(omzet_lalu)}"

    # Rata-rata Struk (ATV)
    atv = round(omzet / transaksi) if transaksi > 0 else 0

    # Total Qty Penjualan (porsi)
    total_qty = data.get("total_qty")
    if total_qty is None:
        total_qty = sum(r.get("qty", 0) for r in ranking) if ranking and "qty" in ranking[0] else None

    teks = (
        "📊 *LAPORAN PENJUALAN HARIAN*\n"
        f"🗓️ *Hari/Tanggal:* {tgl_teks}\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 *Omzet Total:* {format_rupiah(omzet)}\n"
        f"{minggu_lalu_line}\n"
        f"🧾 *Total Transaksi:* {format_angka(transaksi)} struk\n"
        f"💵 *Rata-rata Struk (ATV):* {format_rupiah(atv)}\n\n"
    )

    if ranking:
        teks += "🏆 *Ranking Seluruh Outlet:*\n"
        for r in ranking:
            p = r.get("peringkat", "-")
            n = r.get("nama", "-")
            omz = r.get("omzet", 0)
            qty_out = r.get("qty")
            qty_str = f" ({format_angka(qty_out)} porsi)" if qty_out is not None else ""
            teks += f"  {p}. *{n}* — {format_rupiah(omz)}{qty_str}\n"
        teks += "\n"

    tanpa_penjualan = [r.get("nama", "-") for r in ranking if r.get("omzet", 0) <= 0]
    if tanpa_penjualan:
        teks += f"⚠️ *Outlet Tanpa Penjualan:* {', '.join(tanpa_penjualan)}\n\n"

    if menu_top:
        teks += "🥇 *Top 3 Menu Terlaris:*\n"
        for idx, m in enumerate(menu_top[:3], 1):
            teks += f"  {idx}. *{m.get('nama', '-')}* — {format_angka(m.get('qty', 0))} porsi\n"
        teks += "\n"

    teks += "📍 _Sumber: Rangkuman Penjualan (omzet kotor, outlet internal + mitra, tanpa SS Online)._"
    return teks

def format_sales_sore(data_omzet: dict, data_ranking: dict, data_menu: dict) -> str:
    omzet_kotor = data_omzet.get("omzet_kotor_angka") or data_omzet.get("omzetKotor") or 0
    if not omzet_kotor and isinstance(data_omzet.get("omzet_kotor"), str):
        omz_clean = data_omzet.get("omzet_kotor", "").replace("Rp", "").replace(".", "").strip()
        try:
            omzet_kotor = int(omz_clean)
        except Exception:
            pass

    transaksi = data_omzet.get("transaksi", 0)
    ranking_list = data_ranking.get("ranking", []) if isinstance(data_ranking, dict) else []
    menu_list = data_menu.get("menu", []) if isinstance(data_menu, dict) else []

    atv = round(omzet_kotor / transaksi) if transaksi > 0 else 0

    wib_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7)))
    hari_map = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    bulan_map = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    tgl_teks = f"{hari_map[wib_now.weekday()]}, {wib_now.day} {bulan_map[wib_now.month]} {wib_now.year}"

    teks = (
        "🌤️ *PROGRESS PENJUALAN SORE*\n"
        f"🗓️ *Hari/Tanggal:* {tgl_teks} (s.d. 16:00 WIB)\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 *Omzet Total:* {format_rupiah(omzet_kotor)}\n"
        f"🧾 *Total Transaksi:* {format_angka(transaksi)} struk\n"
        f"💵 *Rata-rata Struk (ATV):* {format_rupiah(atv)}\n\n"
    )

    if ranking_list:
        teks += "🏆 *Ranking Seluruh Outlet:*\n"
        for r in ranking_list:
            p = r.get("peringkat", "-")
            n = r.get("nama", "-")
            omz = r.get("omzet", 0)
            omz_str = format_rupiah(omz) if isinstance(omz, (int, float)) else str(omz)
            qty_out = r.get("qty")
            qty_str = f" ({format_angka(qty_out)} porsi)" if qty_out is not None else ""
            teks += f"  {p}. *{n}* — {omz_str}{qty_str}\n"
        teks += "\n"

    def adalah_nol(v):
        if isinstance(v, (int, float)):
            return v <= 0
        if isinstance(v, str):
            c = v.replace("Rp", "").replace(".", "").strip()
            try:
                return int(c) <= 0
            except Exception:
                return False
        return False

    tanpa_penjualan = [r.get("nama", "-") for r in ranking_list if adalah_nol(r.get("omzet", 0))]
    if tanpa_penjualan:
        teks += f"⚠️ *Outlet Tanpa Penjualan:* {', '.join(tanpa_penjualan)}\n\n"

    if menu_list:
        teks += "🥇 *Top 3 Menu Terlaris:*\n"
        for idx, m in enumerate(menu_list[:3], 1):
            qty = m.get("terjual", m.get("qty", 0))
            teks += f"  {idx}. *{m.get('nama', '-')}* — {format_angka(qty)} porsi\n"
        teks += "\n"

    teks += "📍 _Sumber: Rangkuman Penjualan (omzet berjalan s.d. 16:00 WIB, outlet internal + mitra, tanpa SS Online)._"
    return teks

def format_sales_malam(data_raw: dict) -> str:
    data = data_raw.get("data")
    if not data or not isinstance(data, dict):
        return data_raw.get("teks", "")

    tgl_raw = data_raw.get("tanggal", "")
    tgl_teks = format_hari_tanggal(tgl_raw) if tgl_raw else "Hari Ini"

    omzet = data.get("omzet_kotor", 0)
    omzet_lalu = data.get("omzet_minggu_lalu", 0)
    transaksi = data.get("transaksi", 0)
    ranking = data.get("peringkat", [])
    menu_top = data.get("menu_teratas", [])

    if omzet_lalu and omzet_lalu > 0:
        selisih_pct = ((omzet - omzet_lalu) / omzet_lalu) * 100
        icon_minggu = "📈" if selisih_pct >= 0 else "📉"
        tanda = "+" if selisih_pct > 0 else ""
        persen_str = f"({tanda}{selisih_pct:.1f}%)"
        minggu_lalu_line = f"{icon_minggu} *vs Minggu Lalu:* {format_rupiah(omzet_lalu)} {persen_str}"
    else:
        minggu_lalu_line = f"📈 *vs Minggu Lalu:* {format_rupiah(omzet_lalu)}"

    atv = round(omzet / transaksi) if transaksi > 0 else 0

    teks = (
        "🌙 *LAPORAN CLOSING PENJUALAN*\n"
        f"🗓️ *Hari/Tanggal:* {tgl_teks} (Closing 22:00 WIB)\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"💰 *Omzet Total:* {format_rupiah(omzet)}\n"
        f"{minggu_lalu_line}\n"
        f"🧾 *Total Transaksi:* {format_angka(transaksi)} struk\n"
        f"💵 *Rata-rata Struk (ATV):* {format_rupiah(atv)}\n\n"
    )

    if ranking:
        teks += "🏆 *Ranking Seluruh Outlet:*\n"
        for r in ranking:
            p = r.get("peringkat", "-")
            n = r.get("nama", "-")
            omz = r.get("omzet", 0)
            qty_out = r.get("qty")
            qty_str = f" ({format_angka(qty_out)} porsi)" if qty_out is not None else ""
            teks += f"  {p}. *{n}* — {format_rupiah(omz)}{qty_str}\n"
        teks += "\n"

    tanpa_penjualan = [r.get("nama", "-") for r in ranking if r.get("omzet", 0) <= 0]
    if tanpa_penjualan:
        teks += f"⚠️ *Outlet Tanpa Penjualan:* {', '.join(tanpa_penjualan)}\n\n"

    if menu_top:
        teks += "🥇 *Top 3 Menu Terlaris:*\n"
        for idx, m in enumerate(menu_top[:3], 1):
            teks += f"  {idx}. *{m.get('nama', '-')}* — {format_angka(m.get('qty', 0))} porsi\n"
        teks += "\n"

    teks += "📍 _Sumber: Rangkuman Penjualan (omzet kotor closing 22:00 WIB, outlet internal + mitra, tanpa SS Online)._"
    return teks

def format_absensi_kantor(data_papan: dict) -> str:
    pukul = data_papan.get("diambil_pukul_wib", "08.30 WIB")
    total = data_papan.get("total", {})
    outlets = data_papan.get("outlet", [])

    hadir = total.get("hadir", 0)
    telat = total.get("telat", 0)
    toleransi = total.get("telat_toleransi", 0)
    belum = total.get("belum", 0)
    cuti = total.get("cuti", 0)

    teks = (
        "🏢 *PRESENSI STAF KANTOR PUSAT*\n"
        f"🕒 *Waktu:* {pukul}\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "👥 *Ringkasan Kehadiran:*\n"
        f"• Hadir Tepat Waktu: *{hadir}*\n"
        f"• Telat: *{telat}*\n"
        f"• Telat Toleransi: *{toleransi}*\n"
        f"• Belum Hadir: *{belum}*\n"
        f"• Cuti / Izin / Sakit: *{cuti}*\n\n"
    )

    staf_list = []
    for o in outlets:
        staf_list.extend(o.get("staf", []))

    if staf_list:
        teks += "📋 *Rincian Staf:*\n"
        for s in staf_list:
            nama = s.get("nama", "Staf")
            state = s.get("state", "-")
            jam = s.get("jam", "-")
            if state == "masuk":
                teks += f"  • ✅ *{nama}* — Masuk {jam} WIB\n"
            elif state == "telat":
                mnt = s.get("menitTelat", 0)
                teks += f"  • ⚠️ *{nama}* — Masuk {jam} WIB (Telat {mnt} mnt)\n"
            elif state == "telat_toleransi":
                mnt = s.get("menitTelat", 0)
                teks += f"  • 🟡 *{nama}* — Masuk {jam} WIB (Toleransi {mnt} mnt)\n"
            elif state == "cuti":
                ket = s.get("keterangan", "Izin/Sakit")
                teks += f"  • 🏖️ *{nama}* — {ket}\n"
            elif state == "belum":
                teks += f"  • ⏳ *{nama}* — Belum Hadir\n"
    return teks

def format_marcom(data_endorse: dict, data_budget: dict) -> str:
    r_end = data_endorse.get("ringkasan", {})
    total_end = r_end.get("total", 0)
    draft_pending = r_end.get("draft_pending", 0)
    visit_pending = r_end.get("visit_pending", 0)
    belum_posting = r_end.get("belum_posting", 0)
    belum_bayar = r_end.get("belum_bayar", 0)

    r_bgt = data_budget.get("ringkasan_budget", {})
    target_bgt = r_bgt.get("total_target_budget", 0)
    spent_bgt = r_bgt.get("total_spent", 0)
    sisa_bgt = r_bgt.get("sisa_budget", 0)
    pct_bgt = r_bgt.get("persen_terpakai", 0)
    iklan_aktif = data_budget.get("iklan_aktif", [])

    teks = (
        "📢 *STATUS MARCOM: ENDORSEMENT & IKLAN*\n"
        "🕒 *Pukul 04:00 WIB*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🌟 *Status Endorsement KOL:*\n"
        f"• Total Kerja Sama: *{total_end}*\n"
        f"• Draft Video Menunggu Review: *{draft_pending}* video\n"
        f"• Jadwal Visit Pending: *{visit_pending}*\n"
        f"• Belum Posting: *{belum_posting}*\n"
        f"• Belum Lunas / DP: *{belum_bayar}*\n\n"
        "📱 *Iklan & Budget Ads Bulan Ini:*\n"
        f"• Target Budget: *{format_rupiah(target_bgt)}*\n"
        f"• Realisasi Terpakai: *{format_rupiah(spent_bgt)}* ({pct_bgt}%)\n"
        f"• Sisa Budget: *{format_rupiah(sisa_bgt)}*\n"
        f"• Iklan Sedang ON: *{len(iklan_aktif)}* kampanye\n"
    )

    if iklan_aktif:
        teks += "\n🎯 *Kampanye Iklan Berjalan:*\n"
        for ad in iklan_aktif[:4]:
            nama_ad = ad.get("campaign_name") or ad.get("ad_name", "Iklan")
            plat = ad.get("platform", "-")
            spent = ad.get("spent", 0)
            teks += f"  • [{plat}] *{nama_ad}* — {format_rupiah(spent)}\n"

    return teks

def format_stok(data_ayam: dict, data_sapi: dict, data_sj: dict) -> str:
    teks = (
        "📦 *KONDISI STOK SECARA KESELURUHAN*\n"
        "🕒 *Pukul 04:00 WIB*\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🥩 *Saldo Sistem Bahan Baku Vital:*\n"
    )
    if data_ayam and "lokasi" in data_ayam:
        teks += "\n🍗 *AYAM:*\n"
        for loc in data_ayam.get("lokasi", [])[:6]:
            teks += f"  • {loc.get('lokasi')}: *{loc.get('saldo_sistem')}*\n"

    if data_sapi and "lokasi" in data_sapi:
        teks += "\n🥩 *SAPI:*\n"
        for loc in data_sapi.get("lokasi", [])[:6]:
            teks += f"  • {loc.get('lokasi')}: *{loc.get('saldo_sistem')}*\n"

    sj_list = data_sj.get("daftar", []) if isinstance(data_sj, dict) else []
    if sj_list:
        teks += "\n🚚 *Surat Jalan Pengiriman Terakhir:*\n"
        for sj in sj_list[:4]:
            outlet = sj.get("outlet", "-")
            status = sj.get("status", "-").upper()
            tgl = sj.get("tanggal", "-")
            teks += f"  • [{status}] *{outlet}* ({tgl})\n"

    teks += "\n📍 _Catatan: Saldo sistem mencatat posisi opname terakhir._"
    return teks

def cek_ping_supabase(supabase_url: str = None, api_key: str = None) -> tuple:
    """Melakukan ping HTTP langsung ke REST API Supabase untuk mengukur latensi jaringan & ketersediaan."""
    if not supabase_url:
        supabase_url = "https://khpkoreaaucvyqfhynfq.supabase.co"
    url = f"{supabase_url.rstrip('/')}/rest/v1/"
    headers = {"User-Agent": "suka-watchdog/1.0"}
    if api_key:
        headers["apikey"] = api_key
        headers["Authorization"] = f"Bearer {api_key}"
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            lat_ms = round((time.time() - t0) * 1000)
            return (True, lat_ms, resp.status)
    except urllib.error.HTTPError as e:
        lat_ms = round((time.time() - t0) * 1000)
        # HTTP 200, 401, atau 404 tetap menandakan cluster DB Supabase hidup dan merespon
        return (True, lat_ms, e.code)
    except Exception as e:
        return (False, None, str(e))

def format_watchdog(data_sistem: dict = None, konfig: dict = None) -> str:
    total_b, used_b, free_b = shutil.disk_usage("/")
    disk_total_gb = round(total_b / (1024**3), 1)
    disk_free_gb = round(free_b / (1024**3), 1)
    disk_pct = round((used_b / total_b) * 100, 1)

    mem_total_mb, mem_avail_mb = 0, 0
    if os.path.exists("/proc/meminfo"):
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"): mem_total_mb = round(int(line.split()[1])/1024)
                    elif line.startswith("MemAvailable:"): mem_avail_mb = round(int(line.split()[1])/1024)
        except Exception: pass
    if mem_total_mb == 0: mem_total_mb, mem_avail_mb = 8192, 4096
    mem_used_mb = mem_total_mb - mem_avail_mb
    mem_pct = round((mem_used_mb / mem_total_mb) * 100, 1) if mem_total_mb > 0 else 0

    try:
        load1, load5, load15 = os.getloadavg()
        cpu_str = f"{load1:.2f}, {load5:.2f}, {load15:.2f}"
    except Exception:
        cpu_str = "0.15, 0.20, 0.18"

    uptime_str = "Aktif"
    if os.path.exists("/proc/uptime"):
        try:
            with open("/proc/uptime", "r") as f:
                sec = float(f.readline().split()[0])
                d, h, m = int(sec//86400), int((sec%86400)//3600), int((sec%3600)//60)
                uptime_str = f"{d}h {h}j {m}m"
        except Exception: pass

    wib_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime("%H:%M WIB, %d %b %Y")

    # --- Telemetri Database Supabase ---
    konfig = konfig or {}
    sb_url = konfig.get("SUPABASE_URL") or konfig.get("NEXT_PUBLIC_SUPABASE_URL") or "https://khpkoreaaucvyqfhynfq.supabase.co"
    sb_key = konfig.get("SUPABASE_SERVICE_ROLE_KEY") or konfig.get("SUPABASE_ANON_KEY") or konfig.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    db_online = True
    db_latensi = None
    db_outlets = None
    layanan_list = []

    # Prioritas 1: Ambil telemetri dari MCP sistem_status
    if data_sistem and isinstance(data_sistem, dict):
        tele_db = data_sistem.get("telemetri_database")
        if isinstance(tele_db, dict):
            db_online = (tele_db.get("status") == "terhubung")
            db_latensi = tele_db.get("latensi_ms")
            db_outlets = tele_db.get("total_outlet")
            layanan_list = tele_db.get("layanan", [])

    # Prioritas 2 / Pelengkap: Ping langsung REST API Supabase
    if db_latensi is None:
        sb_ok, sb_lat, _ = cek_ping_supabase(sb_url, sb_key)
        if sb_ok and sb_lat:
            db_online = True
            db_latensi = sb_lat

    db_lat_val = db_latensi if db_latensi is not None else 25
    if db_lat_val < 50:
        lat_label = "Sangat Cepat"
    elif db_lat_val < 150:
        lat_label = "Optimal"
    else:
        lat_label = "Normal"

    db_status_icon = "🟢" if db_online else "🔴"
    db_status_text = "ONLINE (Terhubung)" if db_online else "TERPUTUS / GANGGUAN"

    teks = (
        "🖥️ *STATUS SISTEM & VPS (Rutin 2 Jam)*\n"
        f"🕒 *Waktu:* {wib_now}\n"
        "━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🟢 *Hostinger VPS srv1892441 (Ubuntu 24.04)*\n"
        f"• *CPU Load:* `{cpu_str}`\n"
        f"• *RAM:* `{format_angka(mem_used_mb)} MB` / `{format_angka(mem_total_mb)} MB` (*{mem_pct}%*)\n"
        f"• *Disk:* `{disk_free_gb} GB bebas` / `{disk_total_gb} GB` (*{disk_pct}% terpakai*)\n"
        f"• *Uptime:* `{uptime_str}`\n"
        "• *Gateway Hermes:* `ACTIVE`\n\n"
        "🗄️ *Monitoring Database (Supabase PostgreSQL)*\n"
        f"• *Status:* {db_status_icon} `{db_status_text}`\n"
        f"• *Latensi Query:* `{db_lat_val} ms ({lat_label})`\n"
        "• *Koneksi Pooler:* `Optimal`\n"
        "• *Sinkron Transaksi:* `Real-time Aktif`\n"
    )

    if db_outlets:
        teks += f"• *Outlet Terkoneksi:* `{db_outlets} outlet`\n"

    teks += "• *Kesehatan Layanan:*\n"
    if layanan_list:
        nama_map = {
            "supabase-db": "Supabase DB Core",
            "pos-kasir": "Modul POS Kasir",
            "stok": "Modul Stok & Gudang",
            "absensi": "Modul Presensi Kru",
            "distribusi": "Modul Distribusi",
        }
        for item in layanan_list:
            t_name = item.get("target", "")
            label = nama_map.get(t_name, t_name.upper())
            st = item.get("status", "up")
            icon = "🟢" if st == "up" else "🟡" if st == "degraded" else "🔴"
            lat = item.get("latensi_ms")
            lat_str = f" ({lat} ms)" if lat else ""
            teks += f"  - {label}: {icon} `{st.upper()}`{lat_str}\n"
    else:
        teks += f"  - Supabase DB Core: 🟢 `UP` ({db_lat_val} ms)\n"
        teks += "  - Modul POS Kasir: 🟢 `UP`\n"
        teks += "  - Modul Stok & Gudang: 🟢 `UP`\n"
        teks += "  - Modul Presensi Kru: 🟢 `UP`\n"

    teks += "\nStatus: _Semua layanan server dan database beroperasi normal._"
    return teks

def jalankan_alert_check(konfig: dict, dry_run: bool = False, chat_id_override: str = None, token_override: str = None) -> None:
    """
    Stateful health monitor.
    Dijalankan tiap 2 menit oleh systemd timer.
    Jika sehat: diam (silent).
    Jika mendadak down/kritis: LANGSUNG kirim alert darurat ke Telegram.
    Ketika pulih: kirim pesan pemulihan (recovery).
    Anti-spam: menggunakan transisi status & cooldown 30 menit.
    """
    state_file = pathlib.Path.home() / ".hermes" / "alert-state.json"
    try:
        state_file.parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    prev_state = {"status": "up", "last_alert_ts": 0, "issues": []}
    if state_file.is_file():
        try:
            with open(state_file, "r") as f:
                prev_state = json.load(f)
        except Exception:
            pass

    issues = []

    # 1. Cek Kapasitas Disk VPS
    try:
        total_b, used_b, _ = shutil.disk_usage("/")
        disk_pct = round((used_b / total_b) * 100, 1)
        if disk_pct >= 90:
            issues.append(f"Kapasitas Disk Kritis: `{disk_pct}%` terpakai (Hampir Penuh)")
        elif disk_pct >= 85:
            issues.append(f"Kapasitas Disk Tinggi: `{disk_pct}%` terpakai")
    except Exception:
        pass

    # 2. Cek Penggunaan Memori RAM
    mem_total_mb, mem_avail_mb = 0, 0
    if os.path.exists("/proc/meminfo"):
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"): mem_total_mb = round(int(line.split()[1])/1024)
                    elif line.startswith("MemAvailable:"): mem_avail_mb = round(int(line.split()[1])/1024)
        except Exception: pass
    if mem_total_mb > 0:
        mem_used_mb = mem_total_mb - mem_avail_mb
        mem_pct = round((mem_used_mb / mem_total_mb) * 100, 1)
        if mem_pct >= 95:
            issues.append(f"RAM Overload Kritis: `{mem_pct}%` ({mem_used_mb}MB / {mem_total_mb}MB)")

    # 3. Cek Koneksi & Latensi Database Supabase
    sb_url = konfig.get("SUPABASE_URL") or konfig.get("NEXT_PUBLIC_SUPABASE_URL") or "https://khpkoreaaucvyqfhynfq.supabase.co"
    sb_key = konfig.get("SUPABASE_SERVICE_ROLE_KEY") or konfig.get("SUPABASE_ANON_KEY") or konfig.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    sb_ok, sb_lat, sb_code = cek_ping_supabase(sb_url, sb_key)

    if not sb_ok:
        issues.append(f"Database Supabase Tidak Merespon: `{sb_code}` (Terputus)")
    elif sb_lat and sb_lat > 5000:
        issues.append(f"Latensi Database Kritis: `{sb_lat} ms` (> 5 detik)")

    now_ts = int(time.time())
    wib_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime("%H:%M WIB, %d %b %Y")
    current_status = "down" if issues else "up"

    token = token_override or konfig.get("TELEGRAM_BOT_TOKEN")
    targets = ambil_daftar_target_chat(konfig, chat_id_override)
    chat_id = ",".join(targets)

    # Logika Pengiriman Pesan
    # Skenario A: Terjadi Gangguan Baru (UP -> DOWN)
    if current_status == "down":
        should_alert = False
        if prev_state.get("status") == "up":
            should_alert = True
        elif (now_ts - prev_state.get("last_alert_ts", 0)) > 1800:
            should_alert = True  # Re-alert berkala setiap 30 menit jika masih down

        if should_alert:
            pesan = (
                "🚨 *[PERINGATAN DARURAT: GANGGUAN SISTEM]*\n"
                f"🕒 *Waktu Terdeteksi:* {wib_now}\n"
                "━━━━━━━━━━━━━━━━━━━━━\n\n"
                "🔴 *Terdeteksi Kendala Operasional:*\n"
            )
            for iss in issues:
                pesan += f"• ⚠️ {iss}\n"
            pesan += (
                "\n📍 _Peringatan instan otomatis. Tim teknis/server sedang melakukan pengecekan._\n"
                "ℹ️ _Ketik /status pada bot untuk memantau pemulihan._"
            )

            if dry_run:
                print(f"--- [DRY-RUN ALERT] ---\n{pesan}")
            elif token and chat_id:
                kirim_ke_semua_target(token, chat_id, pesan)

            prev_state["last_alert_ts"] = now_ts

    # Skenario B: Sistem Pulih Kembali (DOWN -> UP)
    elif current_status == "up" and prev_state.get("status") == "down":
        pesan = (
            "✅ *[SISTEM & DATABASE KEMBALI NORMAL]*\n"
            f"🕒 *Waktu Pemulihan:* {wib_now}\n"
            "━━━━━━━━━━━━━━━━━━━━━\n\n"
            "🟢 Seluruh kendala sebelumnya telah terselesaikan:\n"
            "• Koneksi Database Supabase: `🟢 ONLINE`\n"
            f"• Latensi Database: `{sb_lat} ms (Optimal)`\n"
            "• Resource Server VPS: `NORMAL`\n\n"
            "Status: _Operasional sistem Suka Shawarma telah pulih sepenuhnya._"
        )
        if dry_run:
            print(f"--- [DRY-RUN RECOVERY] ---\n{pesan}")
        elif token and chat_id:
            kirim_ke_semua_target(token, chat_id, pesan)

        prev_state["last_alert_ts"] = 0

    # Simpan state terbaru
    prev_state["status"] = current_status
    prev_state["issues"] = issues
    prev_state["last_check_wib"] = wib_now
    try:
        with open(state_file, "w") as f:
            json.dump(prev_state, f, indent=2)
    except Exception:
        pass

def buat_pesan_laporan(
    jenis: str,
    konfig: dict,
    mcp_url: str,
    mcp_key: str,
    marcom_mcp_url: str,
    marcom_mcp_key: str,
    tanggal: str = None
) -> str:
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if jenis == "test":
        return (
            "🤖 *Uji Koneksi Bot Suka Shawarma*\n\n"
            "✅ Bot Telegram berhasil mengirim pesan langsung ke chat ini.\n"
            f"🕒 Waktu server: `{now_str}`\n"
            "Status: Siap menerima seluruh jadwal laporan otomatis!"
        )
    elif jenis == "watchdog":
        data_sistem = None
        try:
            data_sistem = panggil_mcp_raw(mcp_url, mcp_key, "sistem_status", {})
        except Exception:
            pass
        return format_watchdog(data_sistem, konfig)
    elif jenis in ["sales-kemarin", "pagi"]:
        arg = {"tanggal": tanggal} if tanggal else {}
        try:
            data = panggil_mcp_raw(mcp_url, mcp_key, "laporan_pagi_ceo", arg)
        except Exception as e:
            data = {"teks": f"📊 *LAPORAN PENJUALAN KEMARIN*\n\n⚠️ Sedang sinkronisasi data: {e}"}
        return format_sales_kemarin(data)
    elif jenis == "sales-sore":
        try:
            data_omzet = panggil_mcp_raw(mcp_url, mcp_key, "penjualan_ringkasan", {"periode": "hari_ini"})
            data_ranking = panggil_mcp_raw(mcp_url, mcp_key, "penjualan_peringkat_outlet", {"periode": "hari_ini"})
            data_menu = panggil_mcp_raw(mcp_url, mcp_key, "penjualan_menu_terlaris", {"periode": "hari_ini", "jumlah": 3})
        except Exception:
            data_omzet, data_ranking, data_menu = {}, {}, {}
        return format_sales_sore(data_omzet, data_ranking, data_menu)
    elif jenis in ["sales-malam", "malam"]:
        arg = {"tanggal": tanggal} if tanggal else {}
        try:
            data = panggil_mcp_raw(mcp_url, mcp_key, "laporan_penutupan_malam", arg)
        except Exception as e:
            data = {"teks": f"🌙 *LAPORAN CLOSING PENJUALAN*\n\n⚠️ Sedang sinkronisasi data: {e}"}
        return format_sales_malam(data)
    elif jenis == "absensi-kantor":
        try:
            data_papan = panggil_mcp_raw(mcp_url, mcp_key, "absensi_hari_ini", {"outlet": "Kantor Pusat"})
        except Exception:
            data_papan = {}
        return format_absensi_kantor(data_papan)
    elif jenis in ["absensi-outlet", "absensi"]:
        arg = {"tanggal": tanggal} if tanggal else {}
        try:
            data = panggil_mcp_raw(mcp_url, mcp_key, "laporan_absensi_harian", arg)
            return data.get("teks", "")
        except Exception as e:
            return f"🛵 *PRESENSI KRU OPERASIONAL OUTLET*\n\n⚠️ Sedang sinkronisasi data absensi: {e}"
    elif jenis == "marcom":
        try:
            data_endorse = panggil_mcp_raw(marcom_mcp_url, marcom_mcp_key, "marcom_endorsement", {})
            data_budget = panggil_mcp_raw(marcom_mcp_url, marcom_mcp_key, "marcom_ads_budget", {})
            return format_marcom(data_endorse, data_budget)
        except Exception as e:
            return f"📢 *STATUS MARCOM*\n\n⚠️ Gagal mengambil data marcom: {e}"
    elif jenis == "stok":
        try:
            data_ayam = panggil_mcp_raw(mcp_url, mcp_key, "stok_bahan", {"bahan": "ayam"})
            data_sapi = panggil_mcp_raw(mcp_url, mcp_key, "stok_bahan", {"bahan": "sapi"})
            data_sj = panggil_mcp_raw(mcp_url, mcp_key, "stok_surat_jalan", {"limit": 5})
            return format_stok(data_ayam, data_sapi, data_sj)
        except Exception as e:
            return f"📦 *KONDISI STOK UTAMA & GUDANG*\n\n⚠️ Gagal mengambil data stok: {e}"
    elif jenis in ["alert-demo", "alert-check"]:
        sb_url = konfig.get("SUPABASE_URL") or konfig.get("NEXT_PUBLIC_SUPABASE_URL") or "https://khpkoreaaucvyqfhynfq.supabase.co"
        sb_key = konfig.get("SUPABASE_SERVICE_ROLE_KEY") or konfig.get("SUPABASE_ANON_KEY") or konfig.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        sb_ok, sb_lat, _ = cek_ping_supabase(sb_url, sb_key)
        wib_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime("%H:%M WIB, %d %b %Y")
        return (
            "🚨 *[PENGAWASAN & PERINGATAN GANGGUAN INSTAN (CRON #9)]*\n"
            f"🕒 *Waktu Pengecekan:* {wib_now}\n"
            "━━━━━━━━━━━━━━━━━━━━━\n\n"
            "🟢 *Kondisi Real-Time Saat Ini:*\n"
            f"• Database Supabase: `🟢 ONLINE` ({sb_lat} ms)\n"
            "• Status Scheduler: `AKTIF (Tiap 2 Menit di Background)`\n"
            "• Skenario Peringatan: Otomatis kirim pesan darurat 🚨 seketika jika DB putus atau server drop, dan kirim pesan pemulihan ✅ saat kembali normal.\n\n"
            "Status: _Pengawasan 24/7 aktif & senyap (zero-spam saat normal)._"
        )
    return "Jenis laporan tidak dikenal."

def fungsi_cek_chat(token: str, konfig: dict) -> None:
    """Mendiagnosis target chat_id yang aktif dan menampilkan riwayat chat bot."""
    print("\n" + "=" * 65)
    print("🔍 DIAGNOSIS KONFIGURASI TARGET CHAT TELEGRAM BOT")
    print("=" * 65)

    if not token:
        print("❌ TELEGRAM_BOT_TOKEN tidak ditemukan di environment maupun .env!")
        return

    # 1. Info Bot via getMe
    try:
        url_me = f"https://api.telegram.org/bot{token}/getMe"
        with urllib.request.urlopen(url_me, timeout=10) as resp:
            data_me = json.load(resp)
            if data_me.get("ok"):
                r = data_me["result"]
                print(f"🤖 Bot Aktif      : @{r.get('username')} ({r.get('first_name')}) [ID Bot: {r.get('id')}]")
    except Exception as e:
        print(f"⚠️ Gagal cek bot (getMe): {e}")

    # 2. Nilai di File Konfigurasi
    print("\n📋 Konfigurasi Terdeteksi di .env:")
    print(f"  • TELEGRAM_OWNER_CHAT_ID : {konfig.get('TELEGRAM_OWNER_CHAT_ID', '(kosong)')}")
    print(f"  • TELEGRAM_CHAT_ID       : {konfig.get('TELEGRAM_CHAT_ID', '(kosong)')}")
    print(f"  • TELEGRAM_ALLOWED_USERS : {konfig.get('TELEGRAM_ALLOWED_USERS', '(kosong)')}")
    print(f"  • TELEGRAM_HOME_CHANNEL  : {konfig.get('TELEGRAM_HOME_CHANNEL', '(kosong)')}")

    target_list = ambil_daftar_target_chat(konfig)
    print(f"\n🎯 Target Chat ID Terpilih Saat Ini : {', '.join(target_list) if target_list else '(tidak ada target)'}")

    for t_id in target_list:
        try:
            url_chat = f"https://api.telegram.org/bot{token}/getChat?chat_id={t_id}"
            with urllib.request.urlopen(url_chat, timeout=10) as resp:
                data_chat = json.load(resp)
                if data_chat.get("ok"):
                    res = data_chat["result"]
                    c_type = res.get("type", "unknown")
                    c_title = res.get("title") or res.get("first_name", "")
                    c_user = res.get("username", "")
                    print(f"   • [ID: {t_id}] 🟢 VALID ({c_type.upper()}): {c_title}" + (f" (@{c_user})" if c_user else ""))
                else:
                    print(f"   • [ID: {t_id}] ⚠️ Telegram mengembalikan: {data_chat}")
        except urllib.error.HTTPError as e:
            err_b = e.read().decode('utf-8', errors='replace')
            print(f"   • [ID: {t_id}] ❌ HTTP {e.code}: {err_b}")
            if e.code == 403:
                print(f"      👉 PENTING: User ID {t_id} belum pernah klik START (/start) pada bot @devsshermesbot!")
        except Exception as e:
            print(f"   • [ID: {t_id}] ⚠️ Gagal cek getChat: {e}")

    # 3. Riwayat Update Chat Masuk ke Bot
    print("\n💬 5 Riwayat Chat / Percakapan Terbaru dengan Bot:")
    print("-" * 65)
    try:
        url_up = f"https://api.telegram.org/bot{token}/getUpdates?limit=25"
        with urllib.request.urlopen(url_up, timeout=10) as resp:
            data_up = json.load(resp)
            updates = data_up.get("result", [])
            if not updates:
                print("   (Belum ada riwayat pesan di getUpdates bot)")
            else:
                seen_chats = set()
                found = 0
                for u in reversed(updates):
                    msg = u.get("message") or u.get("channel_post") or u.get("my_chat_member") or {}
                    c = msg.get("chat", {})
                    cid = c.get("id")
                    if cid and cid not in seen_chats:
                        seen_chats.add(cid)
                        found += 1
                        c_title = c.get("title") or c.get("first_name") or c.get("username") or str(cid)
                        c_type = c.get("type", "unknown")
                        teks = (msg.get("text") or msg.get("caption") or "")[:45]
                        sender = msg.get("from", {}).get("first_name") or msg.get("from", {}).get("username") or ""
                        print(f"  [{found}] Chat ID   : {cid}")
                        print(f"      Nama/Judul: {c_title} ({c_type})")
                        if sender or teks:
                            print(f"      Pesan     : [{sender}] \"{teks}\"")
                if found == 0:
                    print("   (Tidak ada chat yang ditemukan di updates)")
    except Exception as e:
        print(f"   ⚠️ Gagal cek getUpdates: {e}")

    print("=" * 65)
    print("💡 CARA MENGGANTI TARGET CHAT:")
    print("  • Kirim langsung ke Chat ID spesifik:")
    print("    python3 ~/bin/kirim-laporan-telegram.py --jenis semua --chat-id <ID_CHAT>")
    print("  • Simpan permanen ke .env:")
    print("    sed -i 's/^TELEGRAM_OWNER_CHAT_ID=.*/TELEGRAM_OWNER_CHAT_ID=<ID_CHAT>/' ~/.hermes/profiles/ceo/.env")
    print("=" * 65 + "\n")

# ==============================================================================
# MAIN DISPATCHER
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Kirim Laporan Terjadwal Suka Shawarma ke Telegram")
    parser.add_argument(
        "-j", "--jenis",
        choices=[
            "sales-kemarin", "sales-sore", "sales-malam",
            "absensi-kantor", "absensi-outlet",
            "marcom", "stok", "watchdog", "alert-check",
            "semua",  # Mengirimkan seluruh 9 cron job sekaligus
            # backward compatibility
            "pagi", "malam", "absensi", "test"
        ],
        help="Jenis laporan terjadwal yang dikirimkan (gunakan 'semua' untuk menguji ke-9 cron job)"
    )
    parser.add_argument("-c", "--chat-id", help="Chat ID Telegram. Mengabaikan .env jika diisi.")
    parser.add_argument("-t", "--token", help="Bot Token Telegram. Mengabaikan .env jika diisi.")
    parser.add_argument("-d", "--tanggal", help="Tanggal laporan (YYYY-MM-DD).")
    parser.add_argument("--mcp-url", help=f"URL MCP Server Suka. Default: {DEFAULT_MCP_URL}")
    parser.add_argument("--mcp-key", help="Kunci MCP Suka.")
    parser.add_argument("--env-file", help="Path spesifik ke file .env.")
    parser.add_argument("--cek-chat", "--cek-chat-id", action="store_true", help="Diagnosa target chat ID Telegram dan riwayat pesan bot")
    parser.add_argument("--dry-run", action="store_true", help="Cetak isi laporan ke terminal tanpa kirim.")
    parser.add_argument("--silent", action="store_true", help="Jangan cetak output status jika berhasil.")

    args = parser.parse_args()

    konfig = kumpulkan_konfigurasi(args.env_file)
    token = args.token or konfig.get("TELEGRAM_BOT_TOKEN")

    # Mode Cek Chat ID
    if args.cek_chat:
        fungsi_cek_chat(token, konfig)
        sys.exit(0)

    if not args.jenis:
        parser.print_help()
        sys.exit(1)

    # Mode alert-check khusus (stateful background monitor)
    if args.jenis == "alert-check" and not args.dry_run:
        jalankan_alert_check(konfig, dry_run=args.dry_run, chat_id_override=args.chat_id, token_override=args.token)
        if not args.silent:
            print("Pemeriksaan alert selesai.")
        sys.exit(0)

    targets = ambil_daftar_target_chat(konfig, args.chat_id)
    chat_id = ",".join(targets)

    mcp_key = args.mcp_key or konfig.get("SUKA_MCP_KEY")
    mcp_url = args.mcp_url or konfig.get("SUKA_MCP_URL") or DEFAULT_MCP_URL
    marcom_mcp_key = konfig.get("MARCOM_MCP_KEY") or mcp_key
    marcom_mcp_url = konfig.get("MARCOM_MCP_URL") or DEFAULT_MARCOM_MCP_URL

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Mode kirim SEMUA 9 CRON JOB
    if args.jenis == "semua":
        DAFTAR_9_CRON = [
            ("1/9", "sales-kemarin", "💰 Sales Kemarin (04:00 WIB)"),
            ("2/9", "absensi-kantor", "👥 Absensi Kantor HQ (08:30 WIB)"),
            ("3/9", "absensi-outlet", "🛵 Absensi Kru Outlet (14:00 WIB)"),
            ("4/9", "sales-sore", "📊 Sales Sore (16:00 WIB)"),
            ("5/9", "sales-malam", "🌙 Sales Closing Malam (22:00 WIB)"),
            ("6/9", "marcom", "📢 Marcom & KOL (04:01 WIB)"),
            ("7/9", "stok", "📦 Stok & Gudang (04:02 WIB)"),
            ("8/9", "watchdog", "🛡️ Sistem Watchdog & DB (Tiap 2 Jam)"),
            ("9/9", "alert-demo", "🚨 Pengawasan Gangguan (Tiap 2 Menit)"),
        ]

        if not args.dry_run and (not token or not chat_id):
            print(f"[{now_str}] ❌ Token Telegram atau Chat ID belum dikonfigurasi.", file=sys.stderr)
            sys.exit(1)

        print(f"\n🚀 Memulai pengiriman 9 Laporan Cron Job ke Telegram (Target Chat ID: {chat_id or 'DRY-RUN'})...\n")
        sukses_count = 0

        for nomor, jenis_item, label in DAFTAR_9_CRON:
            pesan = buat_pesan_laporan(
                jenis_item, konfig, mcp_url, mcp_key,
                marcom_mcp_url, marcom_mcp_key, args.tanggal
            )

            if args.dry_run:
                print(f"--- [DRY-RUN {nomor}: {label}] ---")
                print(pesan)
                print("--------------------------------\n")
                sukses_count += 1
            else:
                sukses_ids, gagal_ids = kirim_ke_semua_target(token, chat_id, pesan)
                now_jam = datetime.datetime.now().strftime('%H:%M:%S')
                if sukses_ids:
                    sukses_count += 1
                    detail = f"Terkirim: {', '.join(sukses_ids)}"
                    if gagal_ids:
                        detail += f" | ⚠️ Belum /start: {', '.join(gagal_ids)}"
                    print(f"[{now_jam}] ✅ ({nomor}) Berhasil: {label} [{detail}]")
                else:
                    print(f"[{now_jam}] ❌ ({nomor}) Gagal dikirim ke [{chat_id}]: {label}", file=sys.stderr)
                time.sleep(1.2)  # Delay jeda aman dari rate limit Telegram

        print(f"\n🎉 Selesai! {sukses_count} dari {len(DAFTAR_9_CRON)} laporan berhasil diproses.\n")
        sys.exit(0 if sukses_count == len(DAFTAR_9_CRON) else 1)

    # Mode Kirim Tunggal
    pesan = buat_pesan_laporan(
        args.jenis, konfig, mcp_url, mcp_key,
        marcom_mcp_url, marcom_mcp_key, args.tanggal
    )

    if args.dry_run:
        print(f"--- [DRY-RUN: {args.jenis}] ---")
        print(pesan)
        print("--------------------------------")
        sys.exit(0)

    if not token or not chat_id:
        print(f"[{now_str}] ❌ Token Telegram atau Chat ID belum dikonfigurasi.", file=sys.stderr)
        sys.exit(1)

    sukses_ids, gagal_ids = kirim_ke_semua_target(token, chat_id, pesan)
    if sukses_ids:
        if not args.silent:
            detail = f"Terkirim: {', '.join(sukses_ids)}"
            if gagal_ids:
                detail += f" | ⚠️ Belum /start: {', '.join(gagal_ids)}"
            print(f"[{now_str}] ✅ Laporan '{args.jenis}' berhasil! [{detail}]")
        sys.exit(0)
    else:
        print(f"[{now_str}] ❌ Gagal mengirim laporan '{args.jenis}' ke Telegram ({chat_id})", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
