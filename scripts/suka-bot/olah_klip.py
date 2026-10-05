#!/usr/bin/env python3
"""Olah klip mentah SUKA Bot (Google Flow, latar hijau) jadi aset avatar portal.

Pakai (dari root repo):
  python scripts/suka-bot/olah_klip.py            # olah semua klip, tulis klip.gen.ts, lalu periksa
  python scripts/suka-bot/olah_klip.py --periksa  # hanya periksa hasil yang sudah ada
Butuh: Python 3.10+, numpy, Pillow, ffmpeg di PATH. Video mentah ada di Drive tim;
salin ke folder `sumber_dir` (lihat klip.json) sebelum mengolah.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
from PIL import Image

FPS = 24
BATAS_BEKU = 0.8  # selisih RMS antar frame (64x64 abu) di bawah ini = frame dianggap diam


def hex_ke_rgb(h: str) -> np.ndarray:
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def kunci_hijau(frame: np.ndarray, latar: np.ndarray, t0: float, t1: float) -> np.ndarray:
    """Ganti latar hijau dengan `latar`. Alpha dari dominansi hijau G - max(R,B), lalu despill.

    Sengaja bukan filter chromakey ffmpeg: di klip ini chromakey membuat janggut & wajah tembus.
    """
    a = frame.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    maks_rb = np.maximum(r, b)
    alpha = np.clip(1 - (g - maks_rb - t0) / (t1 - t0), 0, 1)[..., None]
    a[..., 1] = np.minimum(g, maks_rb)
    return (a * alpha + latar * (1 - alpha)).clip(0, 255).round().astype(np.uint8)


def kecil_abu(frame: np.ndarray) -> np.ndarray:
    img = Image.fromarray(frame).convert('L').resize((64, 64), Image.BILINEAR)
    return np.asarray(img, np.float32)


def selisih(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(((a - b) ** 2).mean()))


def ukur_gerak(kecil: list[np.ndarray]) -> dict:
    langkah = [selisih(kecil[i], kecil[i + 1]) for i in range(len(kecil) - 1)]
    return {'median': float(np.median(langkah)), 'sambungan': selisih(kecil[-1], kecil[0]), 'langkah': langkah}


def beku_ujung(langkah: list[float]) -> tuple[int, int]:
    """Jumlah langkah beku berturut-turut di awal dan di akhir klip."""
    def hitung(seq) -> int:
        n = 0
        for v in seq:
            if v >= BATAS_BEKU:
                break
            n += 1
        return n
    return hitung(langkah), hitung(reversed(langkah))


def porsi_sisa_hijau(frame: np.ndarray, ambang: float = 30) -> float:
    a = frame.astype(np.int16)
    return float(((a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > ambang).mean())


def isi_klip_gen(info: dict[str, dict]) -> str:
    baris = [
        "// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.",
        "import type { Klip } from './rencanaPutar'",
        "",
        "export type InfoKlip = { video: string; gambar: string; ulang: boolean; durasiMs: number }",
        "",
        "export const KLIP: Record<Klip, InfoKlip> = {",
    ]
    for nama, i in info.items():
        ulang = 'true' if i['ulang'] else 'false'
        baris.append(
            f"  {nama}: {{ video: '/suka-bot/{nama}.mp4?v={i['sidik_video']}', "
            f"gambar: '/suka-bot/{nama}.webp?v={i['sidik_gambar']}', ulang: {ulang}, durasiMs: {i['durasi_ms']} }},"
        )
    baris.append("}")
    return "\n".join(baris) + "\n"


def sidik(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]
