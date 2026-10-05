#!/usr/bin/env python3
"""Olah klip mentah SUKA Bot (Google Flow, latar hijau) jadi aset avatar portal.

Pakai (dari root repo):
  python scripts/suka-bot/olah_klip.py            # olah semua klip, tulis klip.gen.ts, lalu periksa
  python scripts/suka-bot/olah_klip.py --periksa  # hanya periksa hasil yang sudah ada
Butuh: Python 3.10+, numpy, Pillow, ffmpeg di PATH. Video mentah ada di Drive tim;
salin ke folder `sumber_dir` (lihat klip.json) sebelum mengolah.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
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


ROOT = Path(__file__).resolve().parents[2]
KONFIG = Path(__file__).with_name('klip.json')


def _ffmpeg_baca(args: list[str], sisi: int) -> np.ndarray:
    keluar = subprocess.run(['ffmpeg', '-v', 'error', *args, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                            check=True, capture_output=True).stdout
    return np.frombuffer(keluar, np.uint8).reshape(-1, sisi, sisi, 3)


def olah_satu(nama: str, k: dict, kfg: dict) -> None:
    sumber = ROOT / kfg['sumber_dir'] / k['berkas']
    if not sumber.exists():
        sys.exit(f"[{nama}] berkas sumber tidak ada: {sumber} (salin video mentah dari Drive tim)")
    if not (k['awal'] <= k['frame_gambar'] < k['akhir']):
        sys.exit(f"[{nama}] frame_gambar {k['frame_gambar']} di luar segmen {k['awal']}..{k['akhir']}")
    p, s = kfg['potong'], kfg['ukuran']
    vf = (f"trim=start_frame={k['awal']}:end_frame={k['akhir']},setpts=PTS-STARTPTS,"
          f"crop={p['sisi']}:{p['sisi']}:{p['x']}:{p['y']},scale={s}:{s}:flags=lanczos")
    mentah = _ffmpeg_baca(['-i', str(sumber), '-an', '-vf', vf], s)
    latar, t = hex_ke_rgb(kfg['latar']), kfg['kunci_hijau']
    hasil = np.stack([kunci_hijau(f, latar, t['t0'], t['t1']) for f in mentah])
    keluar = ROOT / kfg['keluar_dir']
    keluar.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{s}x{s}',
                    '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-crf', str(kfg['crf']),
                    '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(keluar / f'{nama}.mp4')],
                   input=hasil.tobytes(), check=True)
    Image.fromarray(hasil[k['frame_gambar'] - k['awal']]).save(keluar / f'{nama}.webp', quality=85)
    print(f"[{nama}] {len(hasil)} frame -> {nama}.mp4 + {nama}.webp")


def hitung_info(kfg: dict) -> dict[str, dict]:
    keluar, info = ROOT / kfg['keluar_dir'], {}
    for nama, k in kfg['klip'].items():
        mp4 = keluar / f'{nama}.mp4'
        n = len(_ffmpeg_baca(['-i', str(mp4)], kfg['ukuran']))
        info[nama] = {'sidik_video': sidik(mp4), 'sidik_gambar': sidik(keluar / f'{nama}.webp'),
                      'ulang': k['ulang'], 'durasi_ms': round(n * 1000 / FPS)}
    return info


def periksa(kfg: dict) -> list[str]:
    galat, keluar, s = [], ROOT / kfg['keluar_dir'], kfg['ukuran']
    for nama, k in kfg['klip'].items():
        mp4, webp = keluar / f'{nama}.mp4', keluar / f'{nama}.webp'
        if not mp4.exists() or not webp.exists():
            galat.append(f"[{nama}] {mp4.name} / {webp.name} tidak ada")
            continue
        kb = mp4.stat().st_size / 1024
        if kb > kfg['maks_kb']:
            galat.append(f"[{nama}] {kb:.0f} KB > {kfg['maks_kb']} KB")
        frames = _ffmpeg_baca(['-i', str(mp4)], s)
        g = ukur_gerak([kecil_abu(f) for f in frames])
        if k['ulang'] and g['sambungan'] >= g['median']:
            galat.append(f"[{nama}] sambungan loop {g['sambungan']:.2f} >= gerak normal {g['median']:.2f}: "
                         "klip berulang wajib dibuat ulang dengan Frames to Video")
        beku_awal, beku_akhir = beku_ujung(g['langkah'])
        if beku_awal > 2 or beku_akhir > 2:
            galat.append(f"[{nama}] beku {beku_awal} langkah di awal / {beku_akhir} di akhir (maks 2): "
                         "naikkan 'awal' / turunkan 'akhir' di klip.json")
        hijau = max(porsi_sisa_hijau(f) for f in frames)
        if hijau > 0.001:
            galat.append(f"[{nama}] sisa hijau {hijau:.3%} piksel")
    if not galat:
        gen = ROOT / kfg['gen_ts']
        if not gen.exists() or gen.read_text(encoding='utf-8') != isi_klip_gen(hitung_info(kfg)):
            galat.append(f"{kfg['gen_ts']} tidak sinkron dengan video: jalankan tanpa --periksa")
    return galat


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--periksa', action='store_true', help='hanya periksa hasil yang sudah ada')
    kfg = json.loads(KONFIG.read_text(encoding='utf-8'))
    if not ap.parse_args().periksa:
        for nama, k in kfg['klip'].items():
            olah_satu(nama, k, kfg)
        (ROOT / kfg['gen_ts']).write_text(isi_klip_gen(hitung_info(kfg)), encoding='utf-8', newline='\n')
        print(f"tulis {kfg['gen_ts']}")
    galat = periksa(kfg)
    for g in galat:
        print('GAGAL', g)
    print('periksa: OK' if not galat else f'periksa: {len(galat)} masalah')
    sys.exit(1 if galat else 0)


if __name__ == '__main__':
    main()
