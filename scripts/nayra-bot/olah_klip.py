#!/usr/bin/env python3
"""Olah klip mentah Nayra MARCOM Bot (Google Flow, latar hijau) jadi aset avatar transparan.

Penggunaan (dari root repo):
  python scripts/nayra-bot/olah_klip.py            # olah semua klip, tulis klip.gen.ts
  python scripts/nayra-bot/olah_klip.py --periksa  # hanya periksa hasil yang sudah ada

Kebutuhan: Python 3.10+, numpy, Pillow, ffmpeg di PATH.
Video mentah ada di `docs/aset/nayra-bot/`.
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
BATAS_BEKU = 0.8
SISA_HIJAU_MAKS = 12


def hex_ke_rgb(h: str) -> np.ndarray:
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def kecil_abu(frame: np.ndarray) -> np.ndarray:
    img = Image.fromarray(frame).convert('L').resize((64, 64), Image.BILINEAR)
    return np.asarray(img, np.float32)


def selisih(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(((a - b) ** 2).mean()))


def ukur_gerak(kecil: list[np.ndarray]) -> dict:
    langkah = [selisih(kecil[i], kecil[i + 1]) for i in range(len(kecil) - 1)]
    return {'median': float(np.median(langkah)), 'sambungan': selisih(kecil[-1], kecil[0]), 'langkah': langkah}


def beku_ujung(langkah: list[float]) -> tuple[int, int]:
    def hitung(seq) -> int:
        n = 0
        for v in seq:
            if v >= BATAS_BEKU:
                break
            n += 1
        return n
    return hitung(langkah), hitung(reversed(langkah))


def perkiraan_latar(frame: np.ndarray, ambang: float = 70) -> np.ndarray:
    """Warna latar hijau = median piksel yang jelas-jelas latar (dominansi hijau > ambang)."""
    a = frame.astype(np.float32)
    latar = a[(a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > ambang]
    return np.median(latar, axis=0) if len(latar) else np.array([53, 161, 72], np.float32)


def kunci_alfa(frame: np.ndarray, t0: float, t1: float, latar: np.ndarray) -> np.ndarray:
    """RGB -> RGBA. Alfa dari dominansi hijau G - max(R,B); warna tepi dipulihkan dari campuran latar."""
    a = frame.astype(np.float32)
    alpha = np.clip(1 - (a[..., 1] - np.maximum(a[..., 0], a[..., 2]) - t0) / (t1 - t0), 0, 1)
    a3 = alpha[..., None]
    depan = np.where(a3 > 0.02, (a - (1 - a3) * latar) / np.maximum(a3, 1e-3), a).clip(0, 255)
    depan[..., 1] = np.minimum(depan[..., 1], np.maximum(depan[..., 0], depan[..., 2]) + SISA_HIJAU_MAKS)
    return np.dstack([depan, alpha * 255]).clip(0, 255).round().astype(np.uint8)


def kecilkan(img: Image.Image, lebar: int, tinggi: int) -> Image.Image:
    """Kecilkan RGBA dengan alfa premultiplied agar tepi halus tanpa garis gelap."""
    return img.convert('RGBa').resize((lebar, tinggi), Image.LANCZOS).convert('RGBA')


def komposit(rgba: np.ndarray, latar: np.ndarray) -> np.ndarray:
    a = rgba.astype(np.float32)
    alpha = a[..., 3:4] / 255
    return (a[..., :3] * alpha + latar * (1 - alpha)).clip(0, 255).round().astype(np.uint8)


def porsi_sisa_hijau(rgba: np.ndarray, ambang: float = 30) -> float:
    a = rgba.astype(np.int16)
    hijau = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > ambang
    return float((hijau & (a[..., 3] > 128)).mean())


def isi_klip_gen(info: dict[str, dict], rasio: float) -> str:
    baris = [
        "// DIBUAT OTOMATIS oleh scripts/nayra-bot/olah_klip.py. Jangan diedit tangan.",
        "",
        "export type KlipNayra = 'diam' | 'berpikir' | 'sapa' | 'bingung'",
        "",
        "export type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }",
        "",
        "/** Rasio lebar dibagi tinggi Nayra (sama untuk semua klip). */",
        f"export const RASIO_NAYRA = {round(rasio, 4)}",
        "",
        "export const KLIP_NAYRA: Record<KlipNayra, InfoKlip> = {",
    ]
    for nama, i in info.items():
        ulang = 'true' if i['ulang'] else 'false'
        baris.append(
            f"  {nama}: {{ webm: '/nayra/{nama}.webm?v={i['sidik_webm']}', "
            f"webp: '/nayra/{nama}.anim.webp?v={i['sidik_anim']}', "
            f"gambar: '/nayra/{nama}.webp?v={i['sidik_gambar']}', ulang: {ulang}, durasiMs: {i['durasi_ms']} }},"
        )
    baris.append("}")
    return "\n".join(baris) + "\n"


def sidik(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


ROOT = Path(__file__).resolve().parents[2]
KONFIG = Path(__file__).with_name('klip.json')
ABU = hex_ke_rgb('#808080')


def _ffmpeg_baca(args: list[str], w: int, h: int, kanal: int) -> np.ndarray:
    pix = 'rgba' if kanal == 4 else 'rgb24'
    keluar = subprocess.run(['ffmpeg', '-v', 'error', *args, '-f', 'rawvideo', '-pix_fmt', pix, '-'],
                            check=True, capture_output=True).stdout
    return np.frombuffer(keluar, np.uint8).reshape(-1, h, w, kanal)


def _lebar(kfg: dict, tinggi: int) -> int:
    p = kfg['potong']
    return round(p['lebar'] / p['tinggi'] * tinggi / 2) * 2


def _baca_webm(path: Path, kfg: dict) -> np.ndarray:
    return _ffmpeg_baca(['-c:v', 'libvpx-vp9', '-i', str(path)], _lebar(kfg, kfg['tinggi_webm']), kfg['tinggi_webm'], 4)


def _frame_berurutan(args: list[str], w: int, h: int):
    proc = subprocess.Popen(['ffmpeg', '-v', 'error', *args, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                            stdout=subprocess.PIPE)
    ukuran = w * h * 3
    while len(buf := proc.stdout.read(ukuran)) == ukuran:
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    if proc.wait() != 0:
        raise subprocess.CalledProcessError(proc.returncode, 'ffmpeg (baca sumber)')


def olah_satu(nama: str, k: dict, kfg: dict) -> None:
    sumber = ROOT / kfg['sumber_dir'] / k['berkas']
    if not sumber.exists():
        sys.exit(f"[{nama}] berkas sumber tidak ada: {sumber}")
    p, t = kfg['potong'], kfg['kunci_hijau']
    th, ta, fps = kfg['tinggi_webm'], kfg['tinggi_anim'], kfg['fps_anim']
    wb, wa = _lebar(kfg, th), _lebar(kfg, ta)
    keluar = ROOT / kfg['keluar_dir']
    keluar.mkdir(parents=True, exist_ok=True)

    print(f"--> [{nama}] Memproses video: {sumber.name} ({wb}x{th} WebM & {wa}x{ta} WebP)...")
    enkoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{wb}x{th}',
                                '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
                                '-b:v', '0', '-crf', str(kfg['crf_webm']), '-row-mt', '1', str(keluar / f'{nama}.webm')],
                               stdin=subprocess.PIPE)
    vf = (f"trim=start_frame={k['awal']}:end_frame={k['akhir']},setpts=PTS-STARTPTS,"
          f"crop={p['lebar']}:{p['tinggi']}:{p['x']}:{p['y']}")
    latar, ims, gambar, n = None, [], None, 0

    for n, f in enumerate(_frame_berurutan(['-i', str(sumber), '-an', '-vf', vf], p['lebar'], p['tinggi']), 1):
        if latar is None:
            latar = perkiraan_latar(f)
        penuh = Image.fromarray(kunci_alfa(f, t['t0'], t['t1'], latar), 'RGBA')
        kecil = kecilkan(penuh, wb, th)
        enkoder.stdin.write(kecil.tobytes())
        if (n - 1) % (FPS // fps) == 0:
            ims.append(kecilkan(penuh, wa, ta))
        if k['awal'] + n - 1 == k['frame_gambar']:
            gambar = kecil

    enkoder.stdin.close()
    if enkoder.wait() != 0:
        sys.exit(f"[{nama}] ffmpeg gagal menulis {nama}.webm")

    if gambar is None and len(ims) > 0:
        gambar = kecilkan(ims[0], wb, th)

    ims[0].save(keluar / f'{nama}.anim.webp', save_all=True, append_images=ims[1:], duration=round(1000 / fps),
                loop=0 if k['ulang'] else 1, quality=kfg['kualitas_anim'], alpha_quality=kfg['kualitas_alfa_anim'],
                method=4)
    gambar.save(keluar / f'{nama}.webp', quality=85, alpha_quality=100)
    print(f"[{nama}] Selesai: {n} frame -> {nama}.webm + {nama}.anim.webp + {nama}.webp")


def hitung_info(kfg: dict) -> dict[str, dict]:
    keluar, info = ROOT / kfg['keluar_dir'], {}
    for nama, k in kfg['klip'].items():
        webm = keluar / f'{nama}.webm'
        info[nama] = {'sidik_webm': sidik(webm), 'sidik_anim': sidik(keluar / f'{nama}.anim.webp'),
                      'sidik_gambar': sidik(keluar / f'{nama}.webp'), 'ulang': k['ulang'],
                      'durasi_ms': round(len(_baca_webm(webm, kfg)) * 1000 / FPS)}
    return info


def periksa(kfg: dict) -> list[str]:
    galat, keluar = [], ROOT / kfg['keluar_dir']
    for nama, k in kfg['klip'].items():
        webm, anim, gambar = keluar / f'{nama}.webm', keluar / f'{nama}.anim.webp', keluar / f'{nama}.webp'
        hilang = [x.name for x in (webm, anim, gambar) if not x.exists()]
        if hilang:
            galat.append(f"[{nama}] tidak ada: {', '.join(hilang)}")
            continue
        for berkas, maks in ((webm, kfg['maks_kb_webm']), (anim, kfg['maks_kb_anim'])):
            kb = berkas.stat().st_size / 1024
            if kb > maks:
                galat.append(f"[{nama}] {berkas.name} {kb:.0f} KB > {maks} KB")
        frames = _baca_webm(webm, kfg)
        h, w = frames.shape[1:3]
        if frames[0, 2, 2, 3] > 10 or frames[0, h // 2, w // 2, 3] < 245:
            galat.append(f"[{nama}] kanal alfa WebM hilang (pojok harus transparan, tengah pekat)")
    if not galat:
        gen = ROOT / kfg['gen_ts']
        harap = isi_klip_gen(hitung_info(kfg), kfg['potong']['lebar'] / kfg['potong']['tinggi'])
        if not gen.exists() or gen.read_text(encoding='utf-8') != harap:
            galat.append(f"{kfg['gen_ts']} tidak sinkron dengan aset: jalankan tanpa --periksa")
    return galat


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--periksa', action='store_true', help='hanya periksa hasil yang sudah ada')
    kfg = json.loads(KONFIG.read_text(encoding='utf-8'))
    if not ap.parse_args().periksa:
        for nama, k in kfg['klip'].items():
            olah_satu(nama, k, kfg)
        rasio = kfg['potong']['lebar'] / kfg['potong']['tinggi']
        (ROOT / kfg['gen_ts']).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / kfg['gen_ts']).write_text(isi_klip_gen(hitung_info(kfg), rasio), encoding='utf-8', newline='\n')
        print(f"Berhasil menulis {kfg['gen_ts']}")
    galat = periksa(kfg)
    for g in galat:
        print('PERINGATAN:', g)
    print('Pemeriksaan selesai: OK' if not galat else f'Pemeriksaan: {len(galat)} catatan')


if __name__ == '__main__':
    main()
