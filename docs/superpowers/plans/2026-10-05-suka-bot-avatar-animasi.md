# SUKA Bot Avatar Animasi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti avatar SUKA Bot di portal (lingkaran "SB") dengan chef 3D yang bergerak dari klip video per pose, berganti pose dengan pelarutan, dan bereaksi ke kursor/hover/klik.

**Architecture:** Skrip Python mengolah klip mentah Google Flow (latar hijau) jadi MP4 320×320 berlatar oranye + gambar cadangan + `klip.gen.ts` bersidik. Di portal, fungsi murni `rencanaPutar` memutuskan klip mana yang diputar; `LayarKlip` memutarnya dengan dua lapisan `<video>` yang dilarutkan; `AvatarSukaBot` (antarmuka tetap) membungkusnya dengan reaksi `framer-motion`.

**Tech Stack:** Python 3.11 + numpy + Pillow + ffmpeg (skrip); Next.js 16 / React 19 / Tailwind v4 / framer-motion 11.18 / Vitest 2 (portal).

**Spec:** `docs/superpowers/specs/2026-10-05-suka-bot-avatar-animasi-design.md`

## Global Constraints

- Branch kerja: `feat/suka-bot-avatar-animasi`. **Sebelum setiap commit jalankan `git branch --show-current`** dan pastikan hasilnya branch itu (otomasi repo pernah memindahkan branch di tengah sesi). Jangan push.
- **Jangan jalankan `yarn install` / `yarn add` / `npx`** (lockfile root divergen karena workspace `SUKASHAWARMA`; `npx` rusak di repo ini). Tambah dependensi dengan menyunting `package.json` saja. Pakai biner root: `../../node_modules/.bin/tsc`, `../../node_modules/.bin/vitest`, `../../node_modules/.bin/next` (dijalankan dari `apps/portal`).
- Dependensi baru portal — persis: `"framer-motion": "^11.0.0"` (dependencies), `"vitest": "^2.1.0"` (devDependencies). Keduanya sudah ter-resolve di `yarn.lock`; **`git diff --stat yarn.lock` harus kosong** di akhir.
- Antarmuka `AvatarSukaBot` tetap: default export, props `{ pose?: Pose; ukuran?: number }` (default `'diam'`, `56`), dan `export type Pose` (`'diam' | 'berpikir' | 'rekap' | 'bingung'`). `SukaBotWidget.tsx` & `PanelSukaBot.tsx` mengimpor keduanya.
- Video mentah (`docs/aset/suka-bot/*.mp4`) **tidak di-commit** (sudah di-gitignore). Video mentah wajib ada di folder itu secara lokal untuk Task 3.
- Angka tetap dari spec: latar `#f29744`; keluaran 320×320, 24 fps, H.264 `yuv420p`, tanpa audio; kotak potong 980×980 di (20, 120), sama untuk semua klip; maks 250 KB per MP4; pelarutan 250 ms; condong maks ±6° dan ±3 px; hover skala 1,06; ditekan 0,95; muncul 0,6 → 1.
- Teks UI & komentar berbahasa Indonesia, hemat komentar seperti kode sekitar. Pesan konsol skrip Python **ASCII saja** (konsol Windows cp1252).
- `apps/portal/next.config.mjs` memakai `typescript.ignoreBuildErrors: true` — build TIDAK menangkap error tipe; `tsc --noEmit` wajib dijalankan sendiri.

---

## Peta berkas

| Berkas | Status | Tanggung jawab |
|---|---|---|
| `scripts/suka-bot/olah_klip.py` | Baru | Fungsi murni (kunci hijau, ukur gerak, render `klip.gen.ts`) + CLI olah/periksa |
| `scripts/suka-bot/test_olah_klip.py` | Baru | Unit test fungsi murni (stdlib `unittest`, tanpa pytest) |
| `scripts/suka-bot/klip.json` | Baru | Konfigurasi: berkas sumber, titik potong, frame gambar per klip |
| `apps/portal/public/suka-bot/{diam,berpikir,rekap,bingung,sapa}.{mp4,webp}` | Baru (hasil skrip) | Aset tayang |
| `apps/portal/public/suka-bot/README.md` | Ganti | Penjelasan aset hasil olahan |
| `apps/portal/src/components/sukaBot/avatar/rencanaPutar.ts` | Baru | Mesin keadaan murni pemutaran |
| `apps/portal/src/components/sukaBot/avatar/rencanaPutar.test.ts` | Baru | Test |
| `apps/portal/src/components/sukaBot/avatar/modeTampil.ts` | Baru | `bolehVideo` murni |
| `apps/portal/src/components/sukaBot/avatar/modeTampil.test.ts` | Baru | Test |
| `apps/portal/src/components/sukaBot/avatar/condong.ts` | Baru | Rumus murni condong kursor |
| `apps/portal/src/components/sukaBot/avatar/condong.test.ts` | Baru | Test |
| `apps/portal/src/components/sukaBot/avatar/klip.gen.ts` | Baru (hasil skrip) | URL bersidik + cara putar + durasi |
| `apps/portal/src/components/sukaBot/avatar/usePemutarAvatar.ts` | Baru | Hook `useReducer` atas `rencanaPutar` |
| `apps/portal/src/components/sukaBot/avatar/useCondongKursor.ts` | Baru | Hook `pointermove` → motion value |
| `apps/portal/src/components/sukaBot/avatar/LayarKlip.tsx` | Baru | Gambar pose + lapisan video + pelarutan |
| `apps/portal/src/components/sukaBot/AvatarSukaBot.tsx` | Tulis ulang | Rangkai semuanya, antarmuka tetap |
| `apps/portal/src/components/sukaBot/SukaBotWidget.tsx` | Ubah kecil | Denyut cincin titik merah |
| `apps/portal/next.config.mjs` | Ubah | Header cache `/suka-bot/:path*` |
| `apps/portal/package.json` | Ubah | Dependensi + skrip `test` |
| `apps/portal/vitest.config.ts` | Baru | Konfigurasi Vitest (node) |

---

### Task 1: Fungsi murni skrip pengolah klip

**Files:**
- Create: `scripts/suka-bot/olah_klip.py`
- Test: `scripts/suka-bot/test_olah_klip.py`

**Interfaces:**
- Produces (dipakai Task 3, di berkas yang sama): `hex_ke_rgb(h: str) -> np.ndarray`, `kunci_hijau(frame, latar, t0, t1) -> np.ndarray(uint8)`, `kecil_abu(frame) -> np.ndarray(float32 64x64)`, `selisih(a, b) -> float`, `ukur_gerak(kecil: list) -> dict{'median','sambungan','langkah'}`, `beku_ujung(langkah) -> (int, int)`, `porsi_sisa_hijau(frame, ambang=30) -> float`, `isi_klip_gen(info: dict) -> str`, `sidik(path) -> str`, konstanta `FPS = 24`, `BATAS_BEKU = 0.8`.

- [ ] **Step 1: Tulis test yang gagal**

`scripts/suka-bot/test_olah_klip.py`:

```python
import unittest
import numpy as np
import olah_klip as ok

LATAR = ok.hex_ke_rgb('#f29744')


def piksel(rgb):
    return np.array([[rgb]], np.uint8)


class TestKunciHijau(unittest.TestCase):
    def test_hijau_latar_jadi_oranye(self):
        hasil = ok.kunci_hijau(piksel((15, 147, 61)), LATAR, 18, 55)
        self.assertEqual(hasil[0, 0].tolist(), [0xf2, 0x97, 0x44])

    def test_kulit_dan_janggut_tidak_berubah(self):
        for rgb in [(230, 180, 150), (40, 30, 25), (245, 238, 220)]:
            hasil = ok.kunci_hijau(piksel(rgb), LATAR, 18, 55)
            self.assertEqual(hasil[0, 0].tolist(), list(rgb), rgb)

    def test_tepi_kehijauan_dicampur_dan_hijaunya_dibuang(self):
        # d = 140 - 100 = 40 -> alpha = 1 - (40-18)/37 = 0.405; despill: G -> 100
        hasil = ok.kunci_hijau(piksel((100, 140, 90)), LATAR, 18, 55)[0, 0].astype(float)
        a = 1 - (40 - 18) / 37
        harap = np.array([100, 100, 90]) * a + np.array([0xf2, 0x97, 0x44]) * (1 - a)
        np.testing.assert_allclose(hasil, harap, atol=1)


class TestGerak(unittest.TestCase):
    def test_beku_ujung(self):
        self.assertEqual(ok.beku_ujung([0.2, 0.3, 3.0, 4.0, 0.1]), (2, 1))
        self.assertEqual(ok.beku_ujung([2.0, 3.0]), (0, 0))
        self.assertEqual(ok.beku_ujung([0.1, 0.1]), (2, 2))

    def test_ukur_gerak_sambungan_dan_median(self):
        f = [np.full((64, 64), v, np.float32) for v in (0, 2, 4, 6)]
        g = ok.ukur_gerak(f)
        self.assertAlmostEqual(g['median'], 2.0)
        self.assertAlmostEqual(g['sambungan'], 6.0)
        self.assertEqual(len(g['langkah']), 3)

    def test_porsi_sisa_hijau(self):
        f = np.zeros((2, 2, 3), np.uint8)
        f[0, 0] = (10, 200, 10)       # hijau mencolok
        f[0, 1] = (100, 120, 100)     # selisih 20 < ambang 30
        self.assertAlmostEqual(ok.porsi_sisa_hijau(f), 0.25)


class TestKlipGen(unittest.TestCase):
    def test_isi_klip_gen(self):
        isi = ok.isi_klip_gen({
            'diam': {'sidik_video': 'aaa', 'sidik_gambar': 'bbb', 'ulang': True, 'durasi_ms': 7000},
            'sapa': {'sidik_video': 'ccc', 'sidik_gambar': 'ddd', 'ulang': False, 'durasi_ms': 5792},
        })
        self.assertEqual(isi, (
            "// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.\n"
            "import type { Klip } from './rencanaPutar'\n"
            "\n"
            "export type InfoKlip = { video: string; gambar: string; ulang: boolean; durasiMs: number }\n"
            "\n"
            "export const KLIP: Record<Klip, InfoKlip> = {\n"
            "  diam: { video: '/suka-bot/diam.mp4?v=aaa', gambar: '/suka-bot/diam.webp?v=bbb', ulang: true, durasiMs: 7000 },\n"
            "  sapa: { video: '/suka-bot/sapa.mp4?v=ccc', gambar: '/suka-bot/sapa.webp?v=ddd', ulang: false, durasiMs: 5792 },\n"
            "}\n"
        ))


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run (dari root repo): `python -m unittest discover -s scripts/suka-bot -p "test_*.py" -v`
Expected: ERROR `ModuleNotFoundError: No module named 'olah_klip'`

- [ ] **Step 3: Tulis fungsi murninya**

`scripts/suka-bot/olah_klip.py`:

```python
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
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `python -m unittest discover -s scripts/suka-bot -p "test_*.py" -v`
Expected: `Ran 7 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
git add scripts/suka-bot/olah_klip.py scripts/suka-bot/test_olah_klip.py
git commit -m "feat(suka-bot): fungsi murni pengolah klip avatar (kunci hijau, ukur gerak, klip.gen)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Logika murni pemutaran di portal + Vitest

**Files:**
- Create: `apps/portal/vitest.config.ts`
- Modify: `apps/portal/package.json`
- Create: `apps/portal/src/components/sukaBot/avatar/rencanaPutar.ts`
- Create: `apps/portal/src/components/sukaBot/avatar/modeTampil.ts`
- Create: `apps/portal/src/components/sukaBot/avatar/condong.ts`
- Test: `apps/portal/src/components/sukaBot/avatar/rencanaPutar.test.ts`, `modeTampil.test.ts`, `condong.test.ts`

**Interfaces:**
- Produces:
  - `rencanaPutar.ts`: `type Pose = 'diam' | 'berpikir' | 'rekap' | 'bingung'`; `type Klip = Pose | 'sapa'`; `type KeadaanPutar = { pose: Pose | null; klip: Klip; sekali: boolean }`; `type Kejadian = { jenis: 'pose'; pose: Pose } | { jenis: 'klik' } | { jenis: 'selesai'; klip: Klip }`; `const AWAL: KeadaanPutar`; `function langkah(k: KeadaanPutar, e: Kejadian): KeadaanPutar`.
  - `modeTampil.ts`: `type KondisiTampil = { kurangiGerak: boolean; hematData: boolean; videoGagal: boolean }`; `function bolehVideo(k: KondisiTampil): boolean`.
  - `condong.ts`: `const MAKS_DERAJAT = 6`, `const MAKS_GESER = 3`, `const JANGKAUAN = 400`; `function hitungCondong(dx: number): { derajat: number; px: number }`.

- [ ] **Step 1: Pasang Vitest di portal (tanpa yarn install)**

Ubah `apps/portal/package.json`: tambahkan skrip `test` dan dev dependency.

```json
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3010",
    "build": "next build",
    "start": "next start -p 3010",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
```

dan di `devDependencies` tambahkan baris `"vitest": "^2.1.0",` (urut abjad: setelah `"typescript"`).

Buat `apps/portal/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
```

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git diff --stat yarn.lock`
Expected: tidak ada keluaran (lockfile tidak berubah).

- [ ] **Step 2: Tulis test yang gagal**

`apps/portal/src/components/sukaBot/avatar/rencanaPutar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AWAL, langkah, type KeadaanPutar, type Kejadian } from './rencanaPutar'

const jalankan = (...kejadian: Kejadian[]): KeadaanPutar => kejadian.reduce(langkah, AWAL)
const pose = (p: 'diam' | 'berpikir' | 'rekap' | 'bingung'): Kejadian => ({ jenis: 'pose', pose: p })
const klik: Kejadian = { jenis: 'klik' }
const selesai = (klip: KeadaanPutar['klip']): Kejadian => ({ jenis: 'selesai', klip })

describe('rencanaPutar', () => {
  it('pose awal diam memutar diam berulang', () => {
    expect(jalankan(pose('diam'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('pose rekap yang bertahan hanya melambai sekali', () => {
    const s = jalankan(pose('rekap'), selesai('rekap'), pose('rekap'), pose('rekap'))
    expect(s).toEqual({ pose: 'rekap', klip: 'diam', sekali: false })
  })

  it('rekap baru saat diam melambai sekali lagi', () => {
    expect(jalankan(pose('diam'), pose('rekap'))).toEqual({ pose: 'rekap', klip: 'rekap', sekali: true })
  })

  it('berpikir memotong lambaian yang sedang main', () => {
    expect(jalankan(pose('rekap'), pose('berpikir'))).toEqual({ pose: 'berpikir', klip: 'berpikir', sekali: false })
  })

  it('jawaban datang: keluar dari berpikir segera', () => {
    expect(jalankan(pose('berpikir'), pose('diam'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('galat setelah berpikir: bingung sekali lalu diam', () => {
    const s = jalankan(pose('berpikir'), pose('bingung'))
    expect(s).toEqual({ pose: 'bingung', klip: 'bingung', sekali: true })
    expect(langkah(s, selesai('bingung'))).toEqual({ pose: 'bingung', klip: 'diam', sekali: false })
  })

  it('klik saat diam memutar sapa, klik beruntun diabaikan, lalu kembali ke diam', () => {
    const s = jalankan(pose('diam'), klik)
    expect(s).toEqual({ pose: 'diam', klip: 'sapa', sekali: true })
    expect(langkah(s, klik)).toBe(s)
    expect(langkah(s, selesai('sapa'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('klik saat berpikir diabaikan', () => {
    const s = jalankan(pose('berpikir'))
    expect(langkah(s, klik)).toBe(s)
  })

  it('klik saat rekap sedang main diabaikan', () => {
    const s = jalankan(pose('rekap'))
    expect(langkah(s, klik)).toBe(s)
  })

  it('rekap tidak menyela bingung (prioritas lebih rendah)', () => {
    const s = jalankan(pose('bingung'), pose('rekap'))
    expect(s).toEqual({ pose: 'rekap', klip: 'bingung', sekali: true })
    expect(langkah(s, selesai('bingung'))).toEqual({ pose: 'rekap', klip: 'diam', sekali: false })
  })

  it('rekap menyela sapa (prioritas lebih tinggi)', () => {
    expect(jalankan(pose('diam'), klik, pose('rekap'))).toEqual({ pose: 'rekap', klip: 'rekap', sekali: true })
  })

  it('pose diam saat rekap main: rekap dituntaskan dulu', () => {
    const s = jalankan(pose('rekap'), pose('diam'))
    expect(s).toEqual({ pose: 'diam', klip: 'rekap', sekali: true })
    expect(langkah(s, selesai('rekap'))).toEqual({ pose: 'diam', klip: 'diam', sekali: false })
  })

  it('selesai dari klip lain (basi) atau saat klip berulang diabaikan', () => {
    const s = jalankan(pose('rekap'), pose('berpikir'))
    expect(langkah(s, selesai('rekap'))).toBe(s)
    const t = jalankan(pose('bingung'))
    expect(langkah(t, selesai('rekap'))).toBe(t)
  })
})
```

`apps/portal/src/components/sukaBot/avatar/modeTampil.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bolehVideo } from './modeTampil'

const normal = { kurangiGerak: false, hematData: false, videoGagal: false }

describe('bolehVideo', () => {
  it('video bila tidak ada hambatan', () => {
    expect(bolehVideo(normal)).toBe(true)
  })
  it('selalu gambar bila animasi dimatikan, hemat data, atau video pernah gagal', () => {
    expect(bolehVideo({ ...normal, kurangiGerak: true })).toBe(false)
    expect(bolehVideo({ ...normal, hematData: true })).toBe(false)
    expect(bolehVideo({ ...normal, videoGagal: true })).toBe(false)
  })
})
```

`apps/portal/src/components/sukaBot/avatar/condong.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hitungCondong, JANGKAUAN, MAKS_DERAJAT, MAKS_GESER } from './condong'

describe('hitungCondong', () => {
  it('nol saat kursor tepat di tengah avatar', () => {
    expect(hitungCondong(0)).toEqual({ derajat: 0, px: 0 })
  })
  it('sebanding jarak, separuh jangkauan = separuh condong', () => {
    expect(hitungCondong(JANGKAUAN / 2)).toEqual({ derajat: MAKS_DERAJAT / 2, px: MAKS_GESER / 2 })
  })
  it('dibatasi maksimum di kedua arah', () => {
    expect(hitungCondong(5000)).toEqual({ derajat: 6, px: 3 })
    expect(hitungCondong(-5000)).toEqual({ derajat: -6, px: -3 })
  })
})
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/portal" && ../../node_modules/.bin/vitest run`
Expected: FAIL — `Failed to resolve import "./rencanaPutar"` (dan dua lainnya).

- [ ] **Step 4: Tulis implementasinya**

`apps/portal/src/components/sukaBot/avatar/rencanaPutar.ts`:

```ts
export type Pose = 'diam' | 'berpikir' | 'rekap' | 'bingung'
export type Klip = Pose | 'sapa'

export type KeadaanPutar = { pose: Pose | null; klip: Klip; sekali: boolean }
export type Kejadian =
  | { jenis: 'pose'; pose: Pose }
  | { jenis: 'klik' }
  | { jenis: 'selesai'; klip: Klip }

export const AWAL: KeadaanPutar = { pose: null, klip: 'diam', sekali: false }

const PERINGKAT: Record<Klip, number> = { diam: 0, sapa: 1, rekap: 2, bingung: 3, berpikir: 4 }
const klipDasar = (pose: Pose | null): Klip => (pose === 'berpikir' ? 'berpikir' : 'diam')

/** Klip sekali-putar dipicu saat pose BERUBAH (widget terus mengirim 'rekap' selama rekap belum dibuka). */
export function langkah(k: KeadaanPutar, e: Kejadian): KeadaanPutar {
  switch (e.jenis) {
    case 'pose': {
      if (e.pose === k.pose) return k
      const pose = e.pose
      if (pose === 'berpikir') return { pose, klip: 'berpikir', sekali: false }
      if (pose === 'rekap' || pose === 'bingung') {
        if (k.sekali && PERINGKAT[k.klip] > PERINGKAT[pose]) return { ...k, pose }
        return { pose, klip: pose, sekali: true }
      }
      if (k.sekali) return { ...k, pose }
      return { pose, klip: 'diam', sekali: false }
    }
    case 'klik':
      if (k.sekali || k.klip === 'berpikir') return k
      return { ...k, klip: 'sapa', sekali: true }
    case 'selesai':
      if (!k.sekali || e.klip !== k.klip) return k
      return { ...k, klip: klipDasar(k.pose), sekali: false }
  }
}
```

`apps/portal/src/components/sukaBot/avatar/modeTampil.ts`:

```ts
export type KondisiTampil = { kurangiGerak: boolean; hematData: boolean; videoGagal: boolean }

/** Video hanya bila pengguna tidak mematikan animasi, tidak hemat data, dan video belum pernah gagal. */
export const bolehVideo = (k: KondisiTampil): boolean => !k.kurangiGerak && !k.hematData && !k.videoGagal
```

`apps/portal/src/components/sukaBot/avatar/condong.ts`:

```ts
export const MAKS_DERAJAT = 6
export const MAKS_GESER = 3
/** Jarak horizontal kursor (px) dari tengah avatar yang menghasilkan condong penuh. */
export const JANGKAUAN = 400

export function hitungCondong(dx: number): { derajat: number; px: number } {
  const t = Math.max(-1, Math.min(1, dx / JANGKAUAN))
  return { derajat: t * MAKS_DERAJAT, px: t * MAKS_GESER }
}
```

- [ ] **Step 5: Jalankan test, pastikan lolos**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/portal" && ../../node_modules/.bin/vitest run`
Expected: `Test Files  3 passed (3)`, `Tests  18 passed (18)`

Catatan: `hitungCondong(0)` bisa menghasilkan `-0` di sebagian kasus; `toEqual` menganggap `0` dan `-0` sama sehingga test di atas lolos. Jangan ganti ke `toStrictEqual`/`Object.is`.

Run: `../../node_modules/.bin/tsc --noEmit -p .`
Expected: tanpa keluaran (0 error).

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git diff --stat yarn.lock   # harus kosong
git add apps/portal/package.json apps/portal/vitest.config.ts apps/portal/src/components/sukaBot/avatar/rencanaPutar.ts apps/portal/src/components/sukaBot/avatar/rencanaPutar.test.ts apps/portal/src/components/sukaBot/avatar/modeTampil.ts apps/portal/src/components/sukaBot/avatar/modeTampil.test.ts apps/portal/src/components/sukaBot/avatar/condong.ts apps/portal/src/components/sukaBot/avatar/condong.test.ts
git commit -m "feat(suka-bot): aturan pemutaran avatar, mode tampil, rumus condong + vitest portal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CLI olah/periksa + hasilkan aset

**Files:**
- Modify: `scripts/suka-bot/olah_klip.py` (tambah bagian I/O & CLI di bawah fungsi murni)
- Create: `scripts/suka-bot/klip.json`
- Create (hasil skrip): `apps/portal/public/suka-bot/{diam,berpikir,rekap,bingung,sapa}.mp4`, `...webp`, `apps/portal/src/components/sukaBot/avatar/klip.gen.ts`
- Modify: `apps/portal/public/suka-bot/README.md`

**Interfaces:**
- Consumes: semua fungsi Task 1; `type Klip` dari `rencanaPutar.ts` (Task 2) — `klip.gen.ts` mengimpornya.
- Produces: `apps/portal/src/components/sukaBot/avatar/klip.gen.ts` mengekspor `type InfoKlip = { video: string; gambar: string; ulang: boolean; durasiMs: number }` dan `const KLIP: Record<Klip, InfoKlip>` dengan kunci `diam, berpikir, rekap, bingung, sapa`.

- [ ] **Step 1: Pastikan video mentah tersedia**

Run: `ls "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/docs/aset/suka-bot/"*.mp4`
Expected: memuat lima berkas yang dirujuk `klip.json` di Step 2. Kalau tidak ada, BERHENTI dan minta owner menyalinnya dari Drive tim.

- [ ] **Step 2: Tulis konfigurasi**

`scripts/suka-bot/klip.json` (titik potong dari pengukuran 5 Okt 2026: buang frame beku di ujung, sisakan 1; `akhir` eksklusif; `frame_gambar` = indeks frame di video SUMBER):

```json
{
  "_catatan": "awal inklusif, akhir eksklusif, frame_gambar = indeks frame di video sumber. Kotak potong sama untuk semua klip (beda kotak = ukuran chef melompat saat pelarutan).",
  "sumber_dir": "docs/aset/suka-bot",
  "keluar_dir": "apps/portal/public/suka-bot",
  "gen_ts": "apps/portal/src/components/sukaBot/avatar/klip.gen.ts",
  "ukuran": 320,
  "potong": { "x": 20, "y": 120, "sisi": 980 },
  "latar": "#f29744",
  "kunci_hijau": { "t0": 18, "t1": 55 },
  "crf": 26,
  "maks_kb": 250,
  "klip": {
    "diam":     { "berkas": "Chef_breathing_and_smiling_1080p_20261005152301.mp4",       "awal": 5, "akhir": 174, "ulang": true,  "frame_gambar": 5 },
    "berpikir": { "berkas": "Chef_stroking_beard_thoughtfully_1080p_20261005152518.mp4", "awal": 6, "akhir": 139, "ulang": true,  "frame_gambar": 60 },
    "rekap":    { "berkas": "Chef_smiling_and_waving_happily_20261005145342.mp4",        "awal": 2, "akhir": 138, "ulang": false, "frame_gambar": 75 },
    "bingung":  { "berkas": "Chef_acting_confused_and_apologetic_20261005145537.mp4",    "awal": 1, "akhir": 137, "ulang": false, "frame_gambar": 40 },
    "sapa":     { "berkas": "Chef_giving_thumbs_up_1080p_20261005145710.mp4",             "awal": 2, "akhir": 141, "ulang": false, "frame_gambar": 85 }
  }
}
```

- [ ] **Step 3: Tambahkan I/O dan CLI ke `olah_klip.py`**

Tambahkan import `argparse`, `json`, `subprocess`, `sys` di blok import atas (sekarang: `hashlib`, `Path`, `numpy`, `Image`), lalu tempel di AKHIR berkas:

```python
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
```

- [ ] **Step 4: Pastikan unit test Task 1 masih lolos**

Run (root repo): `python -m unittest discover -s scripts/suka-bot -p "test_*.py" -v`
Expected: `Ran 7 tests ... OK`

- [ ] **Step 5: Jalankan pengolahan**

Run (root repo): `python scripts/suka-bot/olah_klip.py`
Expected: lima baris `[nama] N frame -> nama.mp4 + nama.webp`, `tulis apps/portal/src/components/sukaBot/avatar/klip.gen.ts`, lalu `periksa: OK`, exit 0.

Kalau `periksa` melapor `beku ... (maks 2)`: geser `awal` naik / `akhir` turun 1–2 frame untuk klip itu di `klip.json`, ulangi Step 5. Kalau melapor `sambungan loop` untuk `diam`/`berpikir`: BERHENTI dan laporkan (klip sumber salah, bukan masalah konfigurasi). Kalau melapor `sisa hijau`: BERHENTI dan laporkan angkanya.

- [ ] **Step 6: Periksa hasil secara visual**

Run (root repo): `python -c "import tempfile, os; from PIL import Image; ims=[Image.open(f'apps/portal/public/suka-bot/{n}.webp') for n in ['diam','berpikir','rekap','bingung','sapa']]; c=Image.new('RGB',(1600,320)); [c.paste(im,(i*320,0)) for i,im in enumerate(ims)]; p=os.path.join(tempfile.gettempdir(),'suka-bot-poster.png'); c.save(p); print(p)"`
Lalu buka path yang dicetak (Read tool). Expected: lima chef di latar oranye polos, tanpa tepi hijau; berpikir = tangan di janggut, rekap = tangan melambai utuh (jari tidak terpotong), bingung = garuk kepala, sapa = jempol. Ukuran chef sama di kelima gambar.

- [ ] **Step 7: Ganti README aset**

`apps/portal/public/suka-bot/README.md` — ganti seluruh isi:

```markdown
Aset avatar SUKA Bot — HASIL OLAHAN SKRIP, jangan diedit tangan.

- `<klip>.mp4`: 320x320, latar oranye menyatu, tanpa audio.
- `<klip>.webp`: gambar cadangan pose (sebelum video siap, mode tanpa animasi,
  hemat data, atau video gagal diputar).

Klip: diam & berpikir (berulang), rekap, bingung, sapa (sekali putar).

Mengolah ulang (dari root repo, video mentah dari Drive tim disalin ke
docs/aset/suka-bot/ dulu):

    python scripts/suka-bot/olah_klip.py

Skrip juga menulis `src/components/sukaBot/avatar/klip.gen.ts` (URL bersidik).
Membuat klip baru: docs/aset/suka-bot/PANDUAN-KLIP-ANIMASI.md.
```

- [ ] **Step 8: Type-check portal (klip.gen.ts kini ikut)**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/portal" && ../../node_modules/.bin/tsc --noEmit -p .`
Expected: tanpa keluaran.

- [ ] **Step 9: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git status --short          # TIDAK boleh ada docs/aset/suka-bot/*.mp4
git add scripts/suka-bot/olah_klip.py scripts/suka-bot/klip.json apps/portal/public/suka-bot apps/portal/src/components/sukaBot/avatar/klip.gen.ts
git commit -m "feat(suka-bot): CLI olah/periksa klip + aset avatar hasil olahan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pemutar avatar + reaksi

**Files:**
- Modify: `apps/portal/package.json` (tambah `framer-motion`)
- Create: `apps/portal/src/components/sukaBot/avatar/usePemutarAvatar.ts`
- Create: `apps/portal/src/components/sukaBot/avatar/useCondongKursor.ts`
- Create: `apps/portal/src/components/sukaBot/avatar/LayarKlip.tsx`
- Rewrite: `apps/portal/src/components/sukaBot/AvatarSukaBot.tsx`

**Interfaces:**
- Consumes: `langkah`, `AWAL`, `type Pose`, `type Klip` (rencanaPutar.ts); `bolehVideo` (modeTampil.ts); `hitungCondong` (condong.ts); `KLIP` (klip.gen.ts).
- Produces:
  - `usePemutarAvatar(pose: Pose): { klip: Klip; klik: () => void; selesai: (klip: Klip) => void }`
  - `useCondongKursor(aktif: boolean): { ref: RefObject<HTMLDivElement | null>; rotate: MotionValue<number>; x: MotionValue<number> }`
  - `LayarKlip` default export, props `{ klip: Klip; video: boolean; onSelesai: (klip: Klip) => void; onGagal: () => void }`
  - `AvatarSukaBot` — antarmuka tetap (Global Constraints).

Tidak ada unit test untuk hook/komponen di task ini (logika keputusan sudah dites di Task 2; menguji hook React di monorepo ini terkena masalah duplikasi versi React). Verifikasinya type-check + uji browser di Task 5.

- [ ] **Step 1: Tambah dependensi**

Di `apps/portal/package.json` bagian `dependencies`, tambahkan `"framer-motion": "^11.0.0",` (setelah `"@suka/design-system"`).

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT" && git diff --stat yarn.lock`
Expected: kosong.

- [ ] **Step 2: Hook pemutar**

`apps/portal/src/components/sukaBot/avatar/usePemutarAvatar.ts`:

```ts
'use client'
import { useCallback, useEffect, useReducer } from 'react'
import { AWAL, langkah, type Klip, type Pose } from './rencanaPutar'

export function usePemutarAvatar(pose: Pose): { klip: Klip; klik: () => void; selesai: (klip: Klip) => void } {
  // Pose awal langsung diterapkan saat inisialisasi agar render pertama tidak sempat menampilkan 'diam'.
  const [keadaan, kirim] = useReducer(langkah, pose, (p) => langkah(AWAL, { jenis: 'pose', pose: p }))
  useEffect(() => { kirim({ jenis: 'pose', pose }) }, [pose])
  const klik = useCallback(() => kirim({ jenis: 'klik' }), [])
  const selesai = useCallback((klip: Klip) => kirim({ jenis: 'selesai', klip }), [])
  return { klip: keadaan.klip, klik, selesai }
}
```

- [ ] **Step 3: Hook condong kursor**

`apps/portal/src/components/sukaBot/avatar/useCondongKursor.ts`:

```ts
'use client'
import { useEffect, useRef, type RefObject } from 'react'
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion'
import { hitungCondong } from './condong'

const PEGAS = { stiffness: 120, damping: 14 }

/** Avatar condong ke arah kursor. Hanya di perangkat bermouse dan bila `aktif`. */
export function useCondongKursor(aktif: boolean): { ref: RefObject<HTMLDivElement | null>; rotate: MotionValue<number>; x: MotionValue<number> } {
  const ref = useRef<HTMLDivElement | null>(null)
  const rotasi = useMotionValue(0)
  const geser = useMotionValue(0)
  const rotate = useSpring(rotasi, PEGAS)
  const x = useSpring(geser, PEGAS)

  useEffect(() => {
    if (!aktif || !window.matchMedia('(pointer: fine)').matches) return
    const gerak = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const b = el.getBoundingClientRect()
      const c = hitungCondong(e.clientX - (b.left + b.width / 2))
      rotasi.set(c.derajat)
      geser.set(c.px)
    }
    window.addEventListener('pointermove', gerak, { passive: true })
    return () => {
      window.removeEventListener('pointermove', gerak)
      rotasi.set(0)
      geser.set(0)
    }
  }, [aktif, rotasi, geser])

  return { ref, rotate, x }
}
```

- [ ] **Step 4: Lapisan klip**

`apps/portal/src/components/sukaBot/avatar/LayarKlip.tsx`:

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { KLIP } from './klip.gen'
import type { Klip } from './rencanaPutar'

const LARUT_DETIK = 0.25
type Lapisan = { kunci: number; klip: Klip; siap: boolean }

function unduhKlipLainDiLatar() {
  const jalan = () => { for (const info of Object.values(KLIP)) fetch(info.video).catch(() => {}) }
  if ('requestIdleCallback' in window) window.requestIdleCallback(jalan, { timeout: 5000 })
  else setTimeout(jalan, 2000)
}

/**
 * Gambar pose selalu ada di bawah (tampil sebelum video siap). Di mode video, klip baru dimuat
 * di lapisan tak terlihat, dilarutkan saat mulai berputar, lalu lapisan lama dibuang.
 */
export default function LayarKlip({ klip, video, onSelesai, onGagal }: {
  klip: Klip
  video: boolean
  onSelesai: (klip: Klip) => void
  onGagal: () => void
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const sudahUnduh = useRef(false)
  const [lapisan, setLapisan] = useState<Lapisan[]>([{ kunci: 0, klip, siap: false }])

  useEffect(() => {
    setLapisan((l) => {
      const atas = l[l.length - 1]
      return atas.klip === klip ? l : [...l, { kunci: atas.kunci + 1, klip, siap: false }]
    })
  }, [klip])

  // Mode gambar: klip sekali-putar dianggap selesai setelah durasinya.
  useEffect(() => {
    if (video || KLIP[klip].ulang) return
    const t = setTimeout(() => onSelesai(klip), KLIP[klip].durasiMs)
    return () => clearTimeout(t)
  }, [klip, video, onSelesai])

  useEffect(() => {
    const saat = () => {
      wadah.current?.querySelectorAll('video').forEach((v) => {
        if (document.hidden) v.pause()
        else if (!v.ended) v.play().catch(() => {})
      })
    }
    document.addEventListener('visibilitychange', saat)
    return () => document.removeEventListener('visibilitychange', saat)
  }, [])

  const tandaiSiap = useCallback((kunci: number) => {
    setLapisan((l) => l.map((x) => (x.kunci === kunci ? { ...x, siap: true } : x)))
    setTimeout(() => setLapisan((l) => l.filter((x) => x.kunci >= kunci)), LARUT_DETIK * 1000 + 50)
    if (!sudahUnduh.current) { sudahUnduh.current = true; unduhKlipLainDiLatar() }
  }, [])

  const mulaiPutar = useCallback((el: HTMLVideoElement | null) => {
    el?.play().catch((e: unknown) => {
      const nama = (e as { name?: string } | null)?.name
      // AbortError = elemen dibuang di tengah jalan (normal); hanya penolakan nyata yang dianggap gagal.
      if (nama === 'NotAllowedError' || nama === 'NotSupportedError') onGagal()
    })
  }, [onGagal])

  return (
    <div ref={wadah} className="absolute inset-0">
      <AnimatePresence initial={false}>
        <m.img
          key={klip}
          src={KLIP[klip].gambar}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: LARUT_DETIK }}
        />
      </AnimatePresence>
      {video && lapisan.map((l, i) => {
        const atas = i === lapisan.length - 1
        const info = KLIP[l.klip]
        return (
          <m.video
            key={l.kunci}
            ref={mulaiPutar}
            src={info.video}
            aria-hidden
            muted
            playsInline
            autoPlay
            preload="auto"
            loop={info.ulang}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: l.siap ? 1 : 0 }}
            transition={{ duration: LARUT_DETIK }}
            onPlaying={() => { if (!l.siap) tandaiSiap(l.kunci) }}
            onEnded={() => { if (atas && !info.ulang) onSelesai(l.klip) }}
            onError={onGagal}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Tulis ulang AvatarSukaBot**

Ganti seluruh isi `apps/portal/src/components/sukaBot/AvatarSukaBot.tsx`:

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from 'framer-motion'
import LayarKlip from './avatar/LayarKlip'
import { bolehVideo } from './avatar/modeTampil'
import type { Pose } from './avatar/rencanaPutar'
import { useCondongKursor } from './avatar/useCondongKursor'
import { usePemutarAvatar } from './avatar/usePemutarAvatar'

export type { Pose } from './avatar/rencanaPutar'

/** Chef SUKA Bot: klip video per pose (lihat avatar/rencanaPutar.ts) + reaksi kursor/hover/klik. */
export default function AvatarSukaBot({ pose = 'diam', ukuran = 56 }: { pose?: Pose; ukuran?: number }) {
  const { klip, klik, selesai } = usePemutarAvatar(pose)
  const kurangiGerak = useReducedMotion() ?? false
  // Server tidak tahu preferensi perangkat: render pertama selalu gambar, video diputuskan setelah mount.
  const [diKlien, setDiKlien] = useState(false)
  const [hematData, setHematData] = useState(false)
  const [videoGagal, setVideoGagal] = useState(false)
  useEffect(() => {
    setHematData((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true)
    setDiKlien(true)
  }, [])
  const gagal = useCallback(() => setVideoGagal(true), [])
  const video = diKlien && bolehVideo({ kurangiGerak, hematData, videoGagal })
  const { ref, rotate, x } = useCondongKursor(!kurangiGerak)

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div ref={ref} style={{ width: ukuran, height: ukuran }} aria-hidden>
          <m.div
            onClick={klik}
            style={{ rotate, x }}
            className="relative h-full w-full rounded-full overflow-hidden bg-suka-orange shadow-lg select-none"
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <LayarKlip klip={klip} video={video} onSelesai={selesai} onGagal={gagal} />
          </m.div>
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
```

(`ref` dipasang di `<div>` biasa, bukan `m.div`, karena tipe `framer-motion` di root memakai `@types/react` 18 sedangkan portal 19 — `div` biasa memakai tipe portal.)

- [ ] **Step 6: Type-check dan test**

Run: `cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/portal" && ../../node_modules/.bin/tsc --noEmit -p .`
Expected: tanpa keluaran. Kalau muncul TS2786/TS2322 yang menyebut tipe dari `framer-motion`, BERHENTI dan laporkan pesannya lengkap (jangan menambal dengan `as any`).

Run: `../../node_modules/.bin/vitest run`
Expected: `Tests  18 passed (18)`

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git diff --stat yarn.lock   # harus kosong
git add apps/portal/package.json apps/portal/src/components/sukaBot/AvatarSukaBot.tsx apps/portal/src/components/sukaBot/avatar/usePemutarAvatar.ts apps/portal/src/components/sukaBot/avatar/useCondongKursor.ts apps/portal/src/components/sukaBot/avatar/LayarKlip.tsx
git commit -m "feat(suka-bot): avatar chef beranimasi (klip per pose, pelarutan, condong kursor)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Titik merah berdenyut, header cache, verifikasi akhir

> **DIGANTIKAN** oleh Task 6–10 (revisi spec §11: seluruh badan, transparan, bisa digeser). Jangan dieksekusi; `next.config.mjs` (header cache) & matcher middleware dibawa ke Task 9.

**Files:**
- Modify: `apps/portal/src/components/sukaBot/SukaBotWidget.tsx:40` (baris `{adaBaru && !buka && <span ... />}`)
- Modify: `apps/portal/next.config.mjs`
- Modify: `CLAUDE.md` (entri sesi)

**Interfaces:**
- Consumes: semua task sebelumnya.
- Produces: tidak ada antarmuka baru.

- [ ] **Step 1: Denyut cincin titik merah**

Di `apps/portal/src/components/sukaBot/SukaBotWidget.tsx`, ganti baris:

```tsx
        {adaBaru && !buka && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white" />}
```

dengan:

```tsx
        {adaBaru && !buka && (
          <span className="absolute top-0 right-0 flex w-3.5 h-3.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white" />
          </span>
        )}
```

- [ ] **Step 2: Header cache aset avatar**

Di `apps/portal/next.config.mjs`, tambahkan properti `headers` di dalam objek `nextConfig` (setelah `typescript: { ignoreBuildErrors: true },`):

```js
  // URL aset avatar memakai sidik (?v=...) dari klip.gen.ts, jadi aman di-cache selamanya.
  async headers() {
    return [
      {
        source: '/suka-bot/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
```

- [ ] **Step 3: Type-check, test, build**

Run (dari `apps/portal`):
```bash
../../node_modules/.bin/tsc --noEmit -p .
../../node_modules/.bin/vitest run
../../node_modules/.bin/next build
```
Expected: tsc tanpa keluaran; `Tests  18 passed (18)`; build sukses (rute `/` dan `/asisten` tercantum).

Run (root repo): `python -m unittest discover -s scripts/suka-bot -p "test_*.py" && python scripts/suka-bot/olah_klip.py --periksa`
Expected: `OK` lalu `periksa: OK`.

Run (root repo): `git diff --stat yarn.lock`
Expected: kosong.

- [ ] **Step 4: Cek header cache di server produksi lokal**

Jalankan `../../node_modules/.bin/next start -p 3010` di latar (dari `apps/portal`), lalu:
`curl -sI "http://localhost:3010/suka-bot/diam.mp4" | grep -i cache-control`
Expected: `Cache-Control: public, max-age=31536000, immutable`. Hentikan server setelahnya. Kalau header lain yang muncul, laporkan apa adanya (jangan ganti strategi tanpa persetujuan).

- [ ] **Step 5: Uji manual di browser (owner/admin)**

`yarn dev` di `apps/portal` (port 3010), login akun owner/admin, buka launcher:
- [ ] chef muncul dengan pop; bila ada rekap belum dibuka, melambai sekali lalu diam, titik merah berdenyut
- [ ] buka panel → avatar 40 px melambai sekali; kirim pertanyaan → berpikir (mengelus janggut, berulang); jawaban datang → kembali diam segera
- [ ] DevTools → Network → Offline, kirim pertanyaan → bingung sekali → diam
- [ ] gerakkan mouse kiri-kanan → avatar condong; hover → membesar; klik avatar → jempol sekali; klik beruntun tidak membuatnya tersendat
- [ ] Windows Settings → Accessibility → Visual effects → Animation effects OFF, muat ulang → hanya gambar pose (tanpa video, tanpa condong/pop), pose tetap berganti
- [ ] Network: tiap `.mp4` diunduh sekali; muat ulang → `(disk cache)` / `(memory cache)`
- [ ] DevTools device toolbar 375 px → avatar & panel tidak keluar layar
- [ ] tidak ada error merah di Console

- [ ] **Step 6: Catat sesi di CLAUDE.md**

Tambahkan entri di akhir bagian Session (sebelum baris `**Last updated:**`), lalu perbarui `**Last updated:**` ke tanggal hari itu:

```markdown
## Session 2026-10-05: SUKA Bot — Avatar Chef Beranimasi (apps/portal)

**Status:** Kode di branch `feat/suka-bot-avatar-animasi`. ⚠️ Perlu merge + **redeploy `portal`**.

**Spec/plan:** `docs/superpowers/specs/2026-10-05-suka-bot-avatar-animasi-design.md`,
`docs/superpowers/plans/2026-10-05-suka-bot-avatar-animasi.md`

- Avatar = chef 3D dari klip Google Flow (Veo) per pose: `diam`/`berpikir` berulang,
  `rekap`/`bingung`/`sapa` sekali putar. Reaksi kursor/hover/klik lewat `framer-motion`.
- **Klip berulang WAJIB dibuat dengan *Frames to Video*** (frame awal = akhir = `chefss.jpeg`);
  klip satu-gambar tidak tersambung mulus (sambungan 3–5× gerak normal per frame).
- Aset di `apps/portal/public/suka-bot/` = hasil `python scripts/suka-bot/olah_klip.py`
  (jangan edit tangan); video mentah di Drive tim, tidak di git. `--periksa` menjaga
  sambungan loop, frame beku, sisa hijau, ukuran, dan sinkron `klip.gen.ts`.
- Gotcha: `chromakey` ffmpeg membuat janggut tembus → pakai kunci dominansi hijau di skrip.
  Kotak potong harus sama untuk semua klip (beda kotak = chef melompat saat pelarutan).
- Portal kini punya Vitest (`yarn test`); dependensi `framer-motion`/`vitest` tanpa ubah lockfile.
```

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
git add apps/portal/src/components/sukaBot/SukaBotWidget.tsx apps/portal/next.config.mjs CLAUDE.md
git commit -m "feat(suka-bot): titik merah berdenyut, cache aset avatar, catatan sesi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Revisi (sore 5 Okt 2026): seluruh badan, transparan, bisa digeser — Task 6–10

Spec §11. Task 1–4 sudah di-commit; Task 6–10 mengganti keluaran Task 3 dan pemutar Task 4.

**Tambahan Global Constraints untuk Task 6–10:**
- **Fitur hanya untuk role `admin`, `owner`, `developer`.** Jangan ubah gerbang yang ada: `bisaSukaBot` di `apps/portal/src/app/launcher/page.tsx:83` (widget dirender + di-import dinamis hanya untuk tiga role itu lewat `SukaBotMount`), cek role di `apps/portal/src/app/asisten/page.tsx:13`, dan `is_owner_or_admin()` di server. `SukaBotWidget` hanya boleh dipakai lewat `SukaBotMount`; `HalamanAsisten` hanya dirender di `asisten/page.tsx` setelah cek role. Jangan membuat rute uji di bawah `/public/` yang ikut ter-commit.
- Kotak potong 1016×1770 di (0, 106); WebM tinggi 320 / 24 fps / maks 350 KB; WebP beranimasi tinggi 280 / 12 fps / maks 550 KB; tinggi tampil 140 px (≥ 640 px) / 110 px; ambang geser 5 px; panel minimal 280 px tinggi.

---

### Task 6: Skrip keluaran transparan (WebM alfa + WebP beranimasi)

**Files:**
- Modify: `scripts/suka-bot/olah_klip.py`, `scripts/suka-bot/test_olah_klip.py`, `scripts/suka-bot/klip.json`
- Delete: `apps/portal/public/suka-bot/*.mp4`
- Regenerate: `apps/portal/public/suka-bot/{klip}.webm`, `{klip}.anim.webp`, `{klip}.webp`, `apps/portal/src/components/sukaBot/avatar/klip.gen.ts`
- Modify: `apps/portal/public/suka-bot/README.md`

**Interfaces:**
- Produces: `klip.gen.ts` mengekspor `type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }`, `const RASIO: number`, `const KLIP: Record<Klip, InfoKlip>`.
- Python: `kunci_alfa(frame, t0, t1) -> uint8 HxWx4`, `komposit(rgba, latar) -> uint8 HxWx3`, `porsi_sisa_hijau(rgba, ambang=30) -> float` (hanya piksel alfa > 128), `isi_klip_gen(info, rasio) -> str` dengan `info[nama] = {sidik_webm, sidik_anim, sidik_gambar, ulang, durasi_ms}`. `kunci_hijau` dihapus.

- [ ] **Step 1: Perbarui test (gagal dulu)**

Di `scripts/suka-bot/test_olah_klip.py`, ganti kelas `TestKunciHijau`, `test_porsi_sisa_hijau`, dan `TestKlipGen` sehingga berkas menjadi:

```python
import unittest
import numpy as np
import olah_klip as ok

LATAR = ok.hex_ke_rgb('#808080')


def piksel(rgb):
    return np.array([[rgb]], np.uint8)


class TestKunciAlfa(unittest.TestCase):
    def test_hijau_latar_jadi_transparan(self):
        self.assertEqual(ok.kunci_alfa(piksel((15, 147, 61)), 18, 55)[0, 0, 3], 0)

    def test_kulit_dan_janggut_pekat_dan_tidak_berubah(self):
        for rgb in [(230, 180, 150), (40, 30, 25), (245, 238, 220)]:
            self.assertEqual(ok.kunci_alfa(piksel(rgb), 18, 55)[0, 0].tolist(), [*rgb, 255], rgb)

    def test_tepi_kehijauan_setengah_transparan_dan_hijaunya_dibuang(self):
        # d = 140 - 100 = 40 -> alpha = 1 - (40-18)/37 = 0.405; despill: G -> 100
        hasil = ok.kunci_alfa(piksel((100, 140, 90)), 18, 55)[0, 0]
        self.assertEqual(hasil[:3].tolist(), [100, 100, 90])
        self.assertAlmostEqual(int(hasil[3]), round((1 - 22 / 37) * 255), delta=1)

    def test_komposit(self):
        rgba = np.array([[[200, 100, 50, 255], [200, 100, 50, 0]]], np.uint8)
        self.assertEqual(ok.komposit(rgba, LATAR).tolist(), [[[200, 100, 50], [128, 128, 128]]])


class TestGerak(unittest.TestCase):
    def test_beku_ujung(self):
        self.assertEqual(ok.beku_ujung([0.2, 0.3, 3.0, 4.0, 0.1]), (2, 1))
        self.assertEqual(ok.beku_ujung([2.0, 3.0]), (0, 0))
        self.assertEqual(ok.beku_ujung([0.1, 0.1]), (2, 2))

    def test_ukur_gerak_sambungan_dan_median(self):
        f = [np.full((64, 64), v, np.float32) for v in (0, 2, 4, 6)]
        g = ok.ukur_gerak(f)
        self.assertAlmostEqual(g['median'], 2.0)
        self.assertAlmostEqual(g['sambungan'], 6.0)
        self.assertEqual(len(g['langkah']), 3)

    def test_porsi_sisa_hijau_hanya_piksel_pekat(self):
        f = np.zeros((2, 2, 4), np.uint8)
        f[0, 0] = (10, 200, 10, 255)    # hijau mencolok, pekat -> dihitung
        f[0, 1] = (10, 200, 10, 0)      # hijau tapi transparan -> diabaikan
        f[1, 0] = (100, 120, 100, 255)  # selisih 20 < ambang 30
        self.assertAlmostEqual(ok.porsi_sisa_hijau(f), 0.25)


class TestKlipGen(unittest.TestCase):
    def test_isi_klip_gen(self):
        isi = ok.isi_klip_gen({
            'diam': {'sidik_webm': 'a1', 'sidik_anim': 'b2', 'sidik_gambar': 'c3', 'ulang': True, 'durasi_ms': 7042},
            'sapa': {'sidik_webm': 'd4', 'sidik_anim': 'e5', 'sidik_gambar': 'f6', 'ulang': False, 'durasi_ms': 5625},
        }, 0.574)
        self.assertEqual(isi, (
            "// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.\n"
            "import type { Klip } from './rencanaPutar'\n"
            "\n"
            "export type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }\n"
            "\n"
            "/** Lebar dibagi tinggi kotak chef (sama untuk semua klip). */\n"
            "export const RASIO = 0.574\n"
            "\n"
            "export const KLIP: Record<Klip, InfoKlip> = {\n"
            "  diam: { webm: '/suka-bot/diam.webm?v=a1', webp: '/suka-bot/diam.anim.webp?v=b2', gambar: '/suka-bot/diam.webp?v=c3', ulang: true, durasiMs: 7042 },\n"
            "  sapa: { webm: '/suka-bot/sapa.webm?v=d4', webp: '/suka-bot/sapa.anim.webp?v=e5', gambar: '/suka-bot/sapa.webp?v=f6', ulang: false, durasiMs: 5625 },\n"
            "}\n"
        ))


if __name__ == '__main__':
    unittest.main()
```

Run (root repo): `python -m unittest discover -s scripts/suka-bot -p "test_*.py"`
Expected: ERROR/FAIL (`kunci_alfa`, `komposit` belum ada; `isi_klip_gen` salah jumlah argumen).

- [ ] **Step 2: Ganti fungsi murni**

Di `scripts/suka-bot/olah_klip.py`, hapus fungsi `kunci_hijau` dan ganti `porsi_sisa_hijau` & `isi_klip_gen` sehingga bagian fungsi murni memuat:

```python
def kunci_alfa(frame: np.ndarray, t0: float, t1: float) -> np.ndarray:
    """RGB -> RGBA: alfa dari dominansi hijau G - max(R,B), RGB di-despill.

    Sengaja bukan filter chromakey ffmpeg: di klip ini chromakey membuat janggut & wajah tembus.
    """
    a = frame.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    maks_rb = np.maximum(r, b)
    alpha = np.clip(1 - (g - maks_rb - t0) / (t1 - t0), 0, 1)
    a[..., 1] = np.minimum(g, maks_rb)
    return np.dstack([a, alpha * 255]).clip(0, 255).round().astype(np.uint8)


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
        "// DIBUAT OTOMATIS oleh scripts/suka-bot/olah_klip.py. Jangan diedit tangan.",
        "import type { Klip } from './rencanaPutar'",
        "",
        "export type InfoKlip = { webm: string; webp: string; gambar: string; ulang: boolean; durasiMs: number }",
        "",
        "/** Lebar dibagi tinggi kotak chef (sama untuk semua klip). */",
        f"export const RASIO = {round(rasio, 4)}",
        "",
        "export const KLIP: Record<Klip, InfoKlip> = {",
    ]
    for nama, i in info.items():
        ulang = 'true' if i['ulang'] else 'false'
        baris.append(
            f"  {nama}: {{ webm: '/suka-bot/{nama}.webm?v={i['sidik_webm']}', "
            f"webp: '/suka-bot/{nama}.anim.webp?v={i['sidik_anim']}', "
            f"gambar: '/suka-bot/{nama}.webp?v={i['sidik_gambar']}', ulang: {ulang}, durasiMs: {i['durasi_ms']} }},"
        )
    baris.append("}")
    return "\n".join(baris) + "\n"
```

Run: `python -m unittest discover -s scripts/suka-bot -p "test_*.py" -v`
Expected: `Ran 8 tests ... OK`

- [ ] **Step 3: Konfigurasi baru**

Ganti seluruh `scripts/suka-bot/klip.json` (titik potong per klip tetap dari pengolahan sebelumnya):

```json
{
  "_catatan": "awal inklusif, akhir eksklusif, frame_gambar = indeks frame di video sumber. Kotak potong sama untuk semua klip = gabungan bounding box seluruh badan kelima klip (lambaian rekap sampai x=0).",
  "sumber_dir": "docs/aset/suka-bot",
  "keluar_dir": "apps/portal/public/suka-bot",
  "gen_ts": "apps/portal/src/components/sukaBot/avatar/klip.gen.ts",
  "potong": { "x": 0, "y": 106, "lebar": 1016, "tinggi": 1770 },
  "kunci_hijau": { "t0": 18, "t1": 55 },
  "tinggi_webm": 320,
  "crf_webm": 35,
  "maks_kb_webm": 350,
  "tinggi_anim": 280,
  "fps_anim": 12,
  "kualitas_anim": 60,
  "maks_kb_anim": 550,
  "klip": {
    "diam":     { "berkas": "Chef_breathing_and_smiling_1080p_20261005152301.mp4",       "awal": 5, "akhir": 174, "ulang": true,  "frame_gambar": 5 },
    "berpikir": { "berkas": "Chef_stroking_beard_thoughtfully_1080p_20261005152518.mp4", "awal": 6, "akhir": 139, "ulang": true,  "frame_gambar": 60 },
    "rekap":    { "berkas": "Chef_smiling_and_waving_happily_20261005145342.mp4",        "awal": 2, "akhir": 131, "ulang": false, "frame_gambar": 75 },
    "bingung":  { "berkas": "Chef_acting_confused_and_apologetic_20261005145537.mp4",    "awal": 1, "akhir": 137, "ulang": false, "frame_gambar": 40 },
    "sapa":     { "berkas": "Chef_giving_thumbs_up_1080p_20261005145710.mp4",             "awal": 2, "akhir": 137, "ulang": false, "frame_gambar": 85 }
  }
}
```

- [ ] **Step 4: Ganti bagian I/O & CLI**

Di `scripts/suka-bot/olah_klip.py`, ganti SELURUH bagian mulai `ROOT = Path(__file__)...` sampai akhir berkas dengan:

```python
ROOT = Path(__file__).resolve().parents[2]
KONFIG = Path(__file__).with_name('klip.json')
ABU = hex_ke_rgb('#808080')  # latar netral untuk mengukur gerak


def _ffmpeg_baca(args: list[str], w: int, h: int, kanal: int) -> np.ndarray:
    pix = 'rgba' if kanal == 4 else 'rgb24'
    keluar = subprocess.run(['ffmpeg', '-v', 'error', *args, '-f', 'rawvideo', '-pix_fmt', pix, '-'],
                            check=True, capture_output=True).stdout
    return np.frombuffer(keluar, np.uint8).reshape(-1, h, w, kanal)


def _lebar(kfg: dict, tinggi: int) -> int:
    p = kfg['potong']
    return round(p['lebar'] / p['tinggi'] * tinggi / 2) * 2


def _baca_webm(path: Path, kfg: dict) -> np.ndarray:
    # Dekoder libvpx-vp9 wajib disebut: dekoder bawaan ffmpeg membuang kanal alfa.
    return _ffmpeg_baca(['-c:v', 'libvpx-vp9', '-i', str(path)], _lebar(kfg, kfg['tinggi_webm']), kfg['tinggi_webm'], 4)


def olah_satu(nama: str, k: dict, kfg: dict) -> None:
    sumber = ROOT / kfg['sumber_dir'] / k['berkas']
    if not sumber.exists():
        sys.exit(f"[{nama}] berkas sumber tidak ada: {sumber} (salin video mentah dari Drive tim)")
    if not (k['awal'] <= k['frame_gambar'] < k['akhir']):
        sys.exit(f"[{nama}] frame_gambar {k['frame_gambar']} di luar segmen {k['awal']}..{k['akhir']}")
    p, t, th = kfg['potong'], kfg['kunci_hijau'], kfg['tinggi_webm']
    wb = _lebar(kfg, th)
    vf = (f"trim=start_frame={k['awal']}:end_frame={k['akhir']},setpts=PTS-STARTPTS,"
          f"crop={p['lebar']}:{p['tinggi']}:{p['x']}:{p['y']},scale={wb}:{th}:flags=lanczos")
    mentah = _ffmpeg_baca(['-i', str(sumber), '-an', '-vf', vf], wb, th, 3)
    rgba = np.stack([kunci_alfa(f, t['t0'], t['t1']) for f in mentah])
    keluar = ROOT / kfg['keluar_dir']
    keluar.mkdir(parents=True, exist_ok=True)

    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{wb}x{th}',
                    '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
                    '-b:v', '0', '-crf', str(kfg['crf_webm']), '-row-mt', '1', str(keluar / f'{nama}.webm')],
                   input=rgba.tobytes(), check=True)

    ta, fps = kfg['tinggi_anim'], kfg['fps_anim']
    wa = _lebar(kfg, ta)
    ims = [Image.fromarray(f, 'RGBA').resize((wa, ta), Image.LANCZOS) for f in rgba[::FPS // fps]]
    ims[0].save(keluar / f'{nama}.anim.webp', save_all=True, append_images=ims[1:], duration=round(1000 / fps),
                loop=0 if k['ulang'] else 1, quality=kfg['kualitas_anim'], alpha_quality=kfg['kualitas_anim'], method=6)

    Image.fromarray(rgba[k['frame_gambar'] - k['awal']], 'RGBA').save(keluar / f'{nama}.webp', quality=85)
    print(f"[{nama}] {len(rgba)} frame -> {nama}.webm + {nama}.anim.webp + {nama}.webp")


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
        g = ukur_gerak([kecil_abu(komposit(f, ABU)) for f in frames])
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
        with Image.open(anim) as im:
            loop_harap = 0 if k['ulang'] else 1
            if getattr(im, 'n_frames', 1) < 2 or im.info.get('loop') != loop_harap:
                galat.append(f"[{nama}] {anim.name}: frame {getattr(im, 'n_frames', 1)}, loop {im.info.get('loop')} "
                             f"(harap > 1 frame, loop {loop_harap})")
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
        (ROOT / kfg['gen_ts']).write_text(isi_klip_gen(hitung_info(kfg), rasio), encoding='utf-8', newline='\n')
        print(f"tulis {kfg['gen_ts']}")
    galat = periksa(kfg)
    for g in galat:
        print('GAGAL', g)
    print('periksa: OK' if not galat else f'periksa: {len(galat)} masalah')
    sys.exit(1 if galat else 0)


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: Hapus MP4 lama, olah ulang**

Run (root repo):
```bash
git rm -q apps/portal/public/suka-bot/*.mp4
python scripts/suka-bot/olah_klip.py
```
Expected: 5 baris `[nama] N frame -> ...`, `tulis ...klip.gen.ts`, `periksa: OK`.
Bila `... KB > ... KB`: naikkan `crf_webm` (maks 40) atau turunkan `kualitas_anim` (min 45) 5 poin, ulangi. Bila `beku`: geser `awal`/`akhir` seperti Task 3. Bila `kanal alfa hilang` atau `sisa hijau`: BERHENTI, laporkan.

- [ ] **Step 6: Cek visual di tiga latar**

Run (root repo):
```bash
python -c "import tempfile,os; from PIL import Image; n=['diam','berpikir','rekap','bingung','sapa']; ims=[Image.open(f'apps/portal/public/suka-bot/{x}.webp').convert('RGBA') for x in n]; w,h=ims[0].size; c=Image.new('RGB',(w*5,h*3)); [c.paste(Image.alpha_composite(Image.new('RGBA',(w,h),bg+(255,)),im).convert('RGB'),(i*w,j*h)) for j,bg in enumerate([(255,247,237),(30,30,30),(90,140,220)]) for i,im in enumerate(ims)]; p=os.path.join(tempfile.gettempdir(),'suka-bot-penuh.png'); c.save(p); print(p)"
```
Buka path yang dicetak. Expected: lima chef seluruh badan (topi sampai sepatu), ukuran sama, tanpa tepi hijau di ketiga latar; jari lambaian `rekap` utuh.

- [ ] **Step 7: README aset**

Ganti seluruh `apps/portal/public/suka-bot/README.md`:

```markdown
Aset avatar SUKA Bot — HASIL OLAHAN SKRIP, jangan diedit tangan.

- `<klip>.webm`: WebM VP9 transparan, 24 fps (Chrome/Edge/Firefox/Android).
- `<klip>.anim.webp`: WebP beranimasi transparan, 12 fps (iPhone/iPad & Safari).
- `<klip>.webp`: gambar diam transparan (mode tanpa animasi, hemat data, gagal putar).

Klip: diam & berpikir (berulang), rekap, bingung, sapa (sekali putar).

Mengolah ulang (dari root repo, video mentah dari Drive tim disalin ke
docs/aset/suka-bot/ dulu):

    python scripts/suka-bot/olah_klip.py

Skrip juga menulis `src/components/sukaBot/avatar/klip.gen.ts` (URL bersidik + RASIO).
Membuat klip baru: docs/aset/suka-bot/PANDUAN-KLIP-ANIMASI.md.
```

- [ ] **Step 8: Commit** (type-check portal sengaja belum: `LayarKlip` masih memakai bentuk `KLIP` lama sampai Task 8)

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
git add scripts/suka-bot apps/portal/public/suka-bot apps/portal/src/components/sukaBot/avatar/klip.gen.ts
git status --short          # tidak boleh ada docs/aset/suka-bot/*.mp4 ter-stage
git commit -m "feat(suka-bot): aset chef seluruh badan transparan (WebM alfa + WebP beranimasi)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Logika murni format & posisi

**Files:**
- Modify: `apps/portal/src/components/sukaBot/avatar/modeTampil.ts`, `modeTampil.test.ts`
- Create: `apps/portal/src/components/sukaBot/avatar/posisi.ts`, `posisi.test.ts`

**Interfaces:**
- Produces:
  - `modeTampil.ts`: `type FormatAnimasi = 'webm' | 'webp'`, `type Sumber = FormatAnimasi | 'gambar'`, `function pilihFormat(ua: string, maxTouchPoints: number): FormatAnimasi` (+ `bolehVideo` tetap).
  - `posisi.ts`: `type Ukuran = { w: number; h: number }`, `type Titik = { x: number; y: number }`, `type Kotak = Titik & Ukuran`, `AMBANG_GESER = 5`, `MARGIN_LAYAR = 8`, `JARAK_PANEL = 12`, `MARGIN_PANEL = 16`, `TINGGI_PANEL_MIN = 280`, `sudahGeser(dx, dy): boolean`, `jepitPosisi(p: Titik, ukuran: Ukuran, layar: Ukuran): Titik`, `posisiAwal(ukuran: Ukuran, layar: Ukuran): Titik`, `ukuranPanel(layar: Ukuran): Ukuran`, `posisiPanel(chef: Kotak, panel: Ukuran, layar: Ukuran): Kotak`.

- [ ] **Step 1: Test (gagal dulu)**

Tambahkan ke akhir `apps/portal/src/components/sukaBot/avatar/modeTampil.test.ts` (dan ubah baris import menjadi `import { bolehVideo, pilihFormat } from './modeTampil'`):

```ts
const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

describe('pilihFormat', () => {
  it('WebM transparan untuk Chromium & Firefox (desktop dan Android)', () => {
    for (const ua of [UA.chromeWin, UA.edge, UA.firefox, UA.android, UA.macChrome]) expect(pilihFormat(ua, 0)).toBe('webm')
  })
  it('WebP beranimasi untuk semua browser iPhone dan Safari Mac', () => {
    expect(pilihFormat(UA.iphoneSafari, 5)).toBe('webp')
    expect(pilihFormat(UA.iphoneChrome, 5)).toBe('webp')
    expect(pilihFormat(UA.macSafari, 0)).toBe('webp')
  })
  it('iPad yang mengaku Macintosh (punya layar sentuh) dapat WebP', () => {
    expect(pilihFormat(UA.macSafari, 5)).toBe('webp')
    expect(pilihFormat(UA.macChrome.replace('Chrome/129.0.0.0 ', 'CriOS/129.0 '), 5)).toBe('webp')
  })
})
```

`apps/portal/src/components/sukaBot/avatar/posisi.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { jepitPosisi, posisiAwal, posisiPanel, sudahGeser, ukuranPanel } from './posisi'

const DESKTOP = { w: 1440, h: 900 }
const HP = { w: 390, h: 844 }
const CHEF_D = { w: 80, h: 140 }
const CHEF_HP = { w: 63, h: 110 }

describe('sudahGeser', () => {
  it('di bawah 5 px masih dianggap klik', () => {
    expect(sudahGeser(3, 4)).toBe(false)
    expect(sudahGeser(4, 4)).toBe(true)
  })
})

describe('jepitPosisi & posisiAwal', () => {
  it('chef tidak bisa keluar layar', () => {
    expect(jepitPosisi({ x: -50, y: 2000 }, CHEF_D, DESKTOP)).toEqual({ x: 8, y: 900 - 140 - 8 })
    expect(jepitPosisi({ x: 5000, y: -9 }, CHEF_D, DESKTOP)).toEqual({ x: 1440 - 80 - 8, y: 8 })
  })
  it('posisi awal di pojok kanan bawah', () => {
    expect(posisiAwal(CHEF_D, DESKTOP)).toEqual({ x: 1440 - 80 - 16, y: 900 - 140 - 16 })
  })
})

describe('ukuranPanel', () => {
  it('desktop 384x576, HP selebar layar dikurangi margin', () => {
    expect(ukuranPanel(DESKTOP)).toEqual({ w: 384, h: 576 })
    expect(ukuranPanel(HP)).toEqual({ w: 358, h: 576 })
  })
})

describe('posisiPanel', () => {
  it('chef di kanan: panel di kiri chef, sejajar bawah', () => {
    const chef = { x: 1344, y: 744, ...CHEF_D }
    expect(posisiPanel(chef, ukuranPanel(DESKTOP), DESKTOP)).toEqual({ x: 1344 - 12 - 384, y: 744 + 140 - 576, w: 384, h: 576 })
  })
  it('chef di kiri: panel di kanan chef', () => {
    const chef = { x: 16, y: 744, ...CHEF_D }
    expect(posisiPanel(chef, ukuranPanel(DESKTOP), DESKTOP)).toEqual({ x: 16 + 80 + 12, y: 744 + 140 - 576, w: 384, h: 576 })
  })
  it('chef di atas: panel tetap di dalam layar (dijepit ke bawah)', () => {
    const chef = { x: 1344, y: 20, ...CHEF_D }
    expect(posisiPanel(chef, ukuranPanel(DESKTOP), DESKTOP).y).toBe(16)
  })
  it('HP, chef di bawah: panel di atas chef tanpa menutupinya', () => {
    const chef = { x: 274, y: 718, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(HP), HP)).toEqual({ x: 16, y: 718 - 12 - 576, w: 358, h: 576 })
  })
  it('HP, chef di atas: panel di bawah chef', () => {
    const chef = { x: 20, y: 40, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(HP), HP)).toEqual({ x: 16, y: 40 + 110 + 12, w: 358, h: 576 })
  })
  it('HP pendek: panel dipendekkan agar muat di atas chef', () => {
    const layar = { w: 375, h: 600 }
    const chef = { x: 300, y: 474, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(layar), layar)).toEqual({ x: 16, y: 16, w: 343, h: 474 - 12 - 16 })
  })
  it('ruang terlalu sempit: tinggi minimal 280 dipertahankan (boleh menutupi chef)', () => {
    const layar = { w: 375, h: 500 }
    const chef = { x: 300, y: 150, ...CHEF_HP }
    expect(posisiPanel(chef, ukuranPanel(layar), layar).h).toBe(280)
  })
})
```

Run (dari `apps/portal`): `../../node_modules/.bin/vitest run`
Expected: FAIL (`pilihFormat` dan `./posisi` belum ada).

- [ ] **Step 2: Implementasi**

Tambahkan ke akhir `apps/portal/src/components/sukaBot/avatar/modeTampil.ts`:

```ts
export type FormatAnimasi = 'webm' | 'webp'
export type Sumber = FormatAnimasi | 'gambar'

/**
 * WebM transparan hanya digambar benar oleh Chromium & Firefox. Semua browser di iPhone/iPad
 * (mesinnya WebKit, termasuk Chrome iOS) dan Safari Mac memakai WebP beranimasi.
 */
export function pilihFormat(ua: string, maxTouchPoints: number): FormatAnimasi {
  const ios = /iPhone|iPad|iPod|CriOS|FxiOS/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua)
  return ios || safari ? 'webp' : 'webm'
}
```

`apps/portal/src/components/sukaBot/avatar/posisi.ts`:

```ts
export type Ukuran = { w: number; h: number }
export type Titik = { x: number; y: number }
export type Kotak = Titik & Ukuran

export const AMBANG_GESER = 5
export const MARGIN_LAYAR = 8
export const JARAK_PANEL = 12
export const MARGIN_PANEL = 16
export const TINGGI_PANEL_MIN = 280

const jepit = (v: number, min: number, maks: number) => Math.min(Math.max(v, min), Math.max(min, maks))

/** Gerakan di bawah ambang tetap dihitung klik, bukan geser. */
export const sudahGeser = (dx: number, dy: number): boolean => dx * dx + dy * dy > AMBANG_GESER * AMBANG_GESER

export function jepitPosisi(p: Titik, ukuran: Ukuran, layar: Ukuran): Titik {
  return {
    x: jepit(p.x, MARGIN_LAYAR, layar.w - ukuran.w - MARGIN_LAYAR),
    y: jepit(p.y, MARGIN_LAYAR, layar.h - ukuran.h - MARGIN_LAYAR),
  }
}

export function posisiAwal(ukuran: Ukuran, layar: Ukuran): Titik {
  return jepitPosisi({ x: layar.w - ukuran.w - 16, y: layar.h - ukuran.h - 16 }, ukuran, layar)
}

export function ukuranPanel(layar: Ukuran): Ukuran {
  return { w: Math.min(384, layar.w - 2 * MARGIN_PANEL), h: Math.min(576, layar.h - 112) }
}

/** Panel di sisi chef yang menghadap tengah layar; bila tak muat (HP), di atas/bawah chef. */
export function posisiPanel(chef: Kotak, panel: Ukuran, layar: Ukuran): Kotak {
  const m = MARGIN_PANEL
  const j = JARAK_PANEL
  const keKiri = chef.x + chef.w / 2 > layar.w / 2
  const muat = keKiri ? chef.x - j - panel.w >= m : chef.x + chef.w + j + panel.w <= layar.w - m
  if (muat) {
    return {
      x: keKiri ? chef.x - j - panel.w : chef.x + chef.w + j,
      y: jepit(chef.y + chef.h - panel.h, m, layar.h - panel.h - m),
      ...panel,
    }
  }
  const x = jepit(chef.x + chef.w / 2 - panel.w / 2, m, layar.w - panel.w - m)
  const diAtas = chef.y + chef.h / 2 > layar.h / 2
  const ruang = diAtas ? chef.y - j - m : layar.h - (chef.y + chef.h + j) - m
  const h = Math.max(Math.min(panel.h, ruang), TINGGI_PANEL_MIN)
  const y = diAtas ? chef.y - j - h : chef.y + chef.h + j
  return { x, y: jepit(y, m, layar.h - h - m), w: panel.w, h }
}
```

- [ ] **Step 3: Test lolos**

Run (dari `apps/portal`): `../../node_modules/.bin/vitest run`
Expected: semua lolos (18 lama + 3 `pilihFormat` + 11 `posisi` = 32).

- [ ] **Step 4: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
A=apps/portal/src/components/sukaBot/avatar
git add $A/modeTampil.ts $A/modeTampil.test.ts $A/posisi.ts $A/posisi.test.ts
git commit -m "feat(suka-bot): pemilih format animasi per perangkat + rumus posisi chef & panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pemutar transparan, avatar seluruh badan, panel tanpa avatar

**Files:**
- Create: `apps/portal/src/components/sukaBot/avatar/animWebp.ts`
- Rewrite: `apps/portal/src/components/sukaBot/avatar/LayarKlip.tsx`, `apps/portal/src/components/sukaBot/AvatarSukaBot.tsx`
- Modify: `apps/portal/src/components/sukaBot/PanelSukaBot.tsx`

**Interfaces:**
- Consumes: `KLIP`, `RASIO` (klip.gen.ts, Task 6); `pilihFormat`, `bolehVideo`, `type Sumber`, `type FormatAnimasi` (Task 7); `usePemutarAvatar`, `useCondongKursor` (Task 4).
- Produces:
  - `ambilBlob(url: string): Promise<Blob>`
  - `LayarKlip` props `{ klip: Klip; sumber: Sumber; onSelesai: (klip: Klip) => void; onGagal: () => void }`
  - `AvatarSukaBot` props `{ pose?: Pose; tinggi?: number; ketukan?: number }` (default `'diam'`, `140`, `0`), `export type Pose`.
  - `PanelSukaBot` props tambahan `onPose?: (pose: Pose) => void`, `ukuran?: { w: number; h: number }`.

- [ ] **Step 1: Cache WebP beranimasi**

`apps/portal/src/components/sukaBot/avatar/animWebp.ts`:

```ts
const cache = new Map<string, Promise<Blob>>()

/**
 * WebP beranimasi diambil sekali, lalu tiap pemutaran memakai URL blob baru: browser berbagi
 * timeline animasi antar <img> ber-URL sama, sehingga klip sekali-putar tak akan mulai dari awal.
 */
export function ambilBlob(url: string): Promise<Blob> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}
```

- [ ] **Step 2: Tulis ulang LayarKlip**

Ganti seluruh `apps/portal/src/components/sukaBot/avatar/LayarKlip.tsx`:

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ambilBlob } from './animWebp'
import { KLIP } from './klip.gen'
import type { FormatAnimasi, Sumber } from './modeTampil'
import type { Klip } from './rencanaPutar'

const LARUT_DETIK = 0.25
const GAYA = 'absolute inset-0 h-full w-full object-contain'
type Lapisan = { kunci: number; klip: Klip; siap: boolean }

function unduhLatar(format: FormatAnimasi) {
  const jalan = () => {
    for (const info of Object.values(KLIP)) {
      if (format === 'webm') fetch(info.webm).catch(() => {})
      else ambilBlob(info.webp).catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(jalan, { timeout: 5000 })
  else setTimeout(jalan, 2000)
}

function LapisanWebp({ klip, tampak, onSiap, onGagal }: { klip: Klip; tampak: boolean; onSiap: () => void; onGagal: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let batal = false
    let dibuat: string | null = null
    ambilBlob(KLIP[klip].webp).then(
      (b) => { if (!batal) { dibuat = URL.createObjectURL(b); setUrl(dibuat) } },
      () => { if (!batal) onGagal() },
    )
    return () => { batal = true; if (dibuat) URL.revokeObjectURL(dibuat) }
  }, [klip, onGagal])
  if (!url) return null
  return (
    <m.img src={url} alt="" draggable={false} className={GAYA}
      initial={{ opacity: 0 }} animate={{ opacity: tampak ? 1 : 0 }} transition={{ duration: LARUT_DETIK }}
      onLoad={onSiap} onError={onGagal} />
  )
}

/**
 * Gambar diam pose selalu ada di bawah (tampil sebelum animasi siap). Klip baru dimuat di lapisan
 * tak terlihat, dilarutkan saat mulai berputar, lalu lapisan lama dibuang.
 */
export default function LayarKlip({ klip, sumber, onSelesai, onGagal }: {
  klip: Klip
  sumber: Sumber
  onSelesai: (klip: Klip) => void
  onGagal: () => void
}) {
  const wadah = useRef<HTMLDivElement>(null)
  const sudahUnduh = useRef(false)
  const timerSelesai = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [lapisan, setLapisan] = useState<Lapisan[]>([{ kunci: 0, klip, siap: false }])

  useEffect(() => {
    setLapisan((l) => {
      const atas = l[l.length - 1]
      if (atas.klip === klip) return l
      const baru = { kunci: atas.kunci + 1, klip, siap: false }
      // Mode gambar tidak merender lapisan animasi, jadi lapisan lama tak perlu disimpan.
      return sumber === 'gambar' ? [baru] : [...l, baru]
    })
  }, [klip, sumber])

  // WebP & gambar tak punya event `ended`: klip sekali-putar dianggap selesai setelah durasinya.
  const jadwalSelesai = useCallback((k: Klip) => {
    clearTimeout(timerSelesai.current)
    if (!KLIP[k].ulang) timerSelesai.current = setTimeout(() => onSelesai(k), KLIP[k].durasiMs)
  }, [onSelesai])
  useEffect(() => () => clearTimeout(timerSelesai.current), [])
  useEffect(() => { if (sumber === 'gambar') jadwalSelesai(klip) }, [klip, sumber, jadwalSelesai])

  useEffect(() => {
    const saat = () => {
      wadah.current?.querySelectorAll('video').forEach((v) => {
        if (document.hidden) v.pause()
        else if (!v.ended) v.play().catch(() => {})
      })
    }
    document.addEventListener('visibilitychange', saat)
    return () => document.removeEventListener('visibilitychange', saat)
  }, [])

  const tandaiSiap = useCallback((l: Lapisan) => {
    setLapisan((xs) => xs.map((x) => (x.kunci === l.kunci ? { ...x, siap: true } : x)))
    setTimeout(() => setLapisan((xs) => xs.filter((x) => x.kunci >= l.kunci)), LARUT_DETIK * 1000 + 50)
    if (sumber === 'webp') jadwalSelesai(l.klip)
    if (!sudahUnduh.current && sumber !== 'gambar') { sudahUnduh.current = true; unduhLatar(sumber) }
  }, [sumber, jadwalSelesai])

  const mulaiPutar = useCallback((el: HTMLVideoElement | null) => {
    el?.play().catch((e: unknown) => {
      const nama = (e as { name?: string } | null)?.name
      // AbortError = dibuang di tengah jalan / tab tersembunyi (normal); hanya penolakan nyata = gagal.
      if (nama === 'NotAllowedError' || nama === 'NotSupportedError') onGagal()
    })
  }, [onGagal])

  // Animasi transparan: gambar diam & lapisan lama wajib hilang saat lapisan baru tampil,
  // kalau tidak chef terlihat dobel (yang lama tembus di belakang yang bergerak).
  const adaSiap = sumber !== 'gambar' && lapisan.some((l) => l.siap)
  return (
    <div ref={wadah} className="absolute inset-0">
      <AnimatePresence initial={false}>
        {!adaSiap && (
          <m.img key={klip} src={KLIP[klip].gambar} alt="" draggable={false} className={GAYA}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: LARUT_DETIK }} />
        )}
      </AnimatePresence>
      {sumber !== 'gambar' && lapisan.map((l, i) => {
        const atas = i === lapisan.length - 1
        const tampak = l.siap && !lapisan.slice(i + 1).some((x) => x.siap)
        // Hanya lapisan teratas yang boleh tampil: klip lama yang telat mulai tidak boleh menyela.
        const onSiap = () => { if (atas && !l.siap) tandaiSiap(l) }
        if (sumber === 'webp') {
          return <LapisanWebp key={l.kunci} klip={l.klip} tampak={tampak} onSiap={onSiap} onGagal={onGagal} />
        }
        const info = KLIP[l.klip]
        return (
          <m.video key={l.kunci} ref={mulaiPutar} src={info.webm} aria-hidden muted playsInline autoPlay
            preload="auto" loop={info.ulang} className={GAYA}
            initial={{ opacity: 0 }} animate={{ opacity: tampak ? 1 : 0 }} transition={{ duration: LARUT_DETIK }}
            onPlaying={onSiap}
            onEnded={() => { if (atas && !info.ulang) onSelesai(l.klip) }}
            onError={onGagal} />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Tulis ulang AvatarSukaBot**

Ganti seluruh `apps/portal/src/components/sukaBot/AvatarSukaBot.tsx`:

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from 'framer-motion'
import LayarKlip from './avatar/LayarKlip'
import { RASIO } from './avatar/klip.gen'
import { bolehVideo, pilihFormat, type FormatAnimasi, type Sumber } from './avatar/modeTampil'
import type { Pose } from './avatar/rencanaPutar'
import { useCondongKursor } from './avatar/useCondongKursor'
import { usePemutarAvatar } from './avatar/usePemutarAvatar'

export type { Pose } from './avatar/rencanaPutar'

/**
 * Chef SUKA Bot seluruh badan (klip per pose, lihat avatar/rencanaPutar.ts) + reaksi kursor/hover.
 * Klik ditangani pemanggil (widget membedakan klik dari geser); `ketukan` yang bertambah memicu `sapa`.
 */
export default function AvatarSukaBot({ pose = 'diam', tinggi = 140, ketukan = 0 }: { pose?: Pose; tinggi?: number; ketukan?: number }) {
  const { klip, klik, selesai } = usePemutarAvatar(pose)
  useEffect(() => { if (ketukan > 0) klik() }, [ketukan, klik])

  const kurangiGerak = useReducedMotion() ?? false
  // Server tidak tahu perangkatnya: render pertama selalu gambar, format diputuskan setelah mount.
  const [perangkat, setPerangkat] = useState<{ format: FormatAnimasi; hematData: boolean } | null>(null)
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } }
    setPerangkat({ format: pilihFormat(nav.userAgent, nav.maxTouchPoints ?? 0), hematData: nav.connection?.saveData === true })
  }, [])
  const [videoGagal, setVideoGagal] = useState(false)
  const gagal = useCallback(() => setVideoGagal(true), [])
  const sumber: Sumber = perangkat && bolehVideo({ kurangiGerak, hematData: perangkat.hematData, videoGagal })
    ? perangkat.format
    : 'gambar'
  const { ref, rotate, x } = useCondongKursor(!kurangiGerak)

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div ref={ref} style={{ width: Math.round(tinggi * RASIO), height: tinggi }} aria-hidden>
          <m.div
            style={{ rotate, x, transformOrigin: '50% 100%' }}
            className="relative h-full w-full select-none"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <LayarKlip klip={klip} sumber={sumber} onSelesai={selesai} onGagal={gagal} />
          </m.div>
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
```

- [ ] **Step 4: Panel tanpa avatar**

Di `apps/portal/src/components/sukaBot/PanelSukaBot.tsx`:

1. Ganti baris import `import AvatarSukaBot, { type Pose } from './AvatarSukaBot'` dengan `import type { Pose } from './AvatarSukaBot'`.
2. Ganti signature komponen dengan:

```tsx
export default function PanelSukaBot({ apiBase, penuh = false, onRekap, onPose, ukuran }: {
  apiBase: string
  penuh?: boolean
  onRekap?: (r: Rekap) => void
  /** Pose chef mengikuti keadaan panel (berpikir saat menunggu, bingung saat galat). */
  onPose?: (pose: Pose) => void
  /** Ukuran dari widget (panel melayang di samping chef). */
  ukuran?: { w: number; h: number }
}) {
```

3. Tepat setelah baris `const bawah = useRef<HTMLDivElement>(null)`, tambahkan:

```tsx
  useEffect(() => { onPose?.(pose) }, [pose, onPose])
```

4. Ganti `className` div terluar komponen beserta isinya (baris `<div className={`flex flex-col bg-white ...`}>`) dengan:

```tsx
    <div
      style={ukuran ? { width: ukuran.w, height: ukuran.h } : undefined}
      className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-suka-orange/20 overflow-hidden ${penuh ? 'h-[calc(100vh-8rem)]' : ukuran ? '' : 'w-[min(24rem,calc(100vw-2rem))] h-[min(36rem,calc(100vh-7rem))]'}`}
    >
```

5. Hapus baris `<AvatarSukaBot pose={pose} ukuran={40} />` di kepala panel.

- [ ] **Step 5: Type-check & test**

Widget dan halaman `/asisten` masih memakai bentuk lama sampai Task 9; type-check penuh dijalankan di Task 9. Di sini cek berkas Task 8 saja:

Run (dari `apps/portal`): `../../node_modules/.bin/tsc --noEmit -p . 2>&1 | grep -v "SukaBotWidget.tsx" ; ../../node_modules/.bin/vitest run`
Expected: tidak ada error selain di `SukaBotWidget.tsx` (prop `ukuran` lama); 32 test lolos.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
S=apps/portal/src/components/sukaBot
git add $S/avatar/animWebp.ts $S/avatar/LayarKlip.tsx $S/AvatarSukaBot.tsx $S/PanelSukaBot.tsx
git commit -m "feat(suka-bot): pemutar chef transparan (WebM/WebP), panel tanpa avatar lingkaran

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Chef bisa digeser + panel ikut chef + halaman /asisten

**Files:**
- Create: `apps/portal/src/components/sukaBot/useGeserChef.ts`
- Rewrite: `apps/portal/src/components/sukaBot/SukaBotWidget.tsx` (komponen `Widget` saja; `Pengaman` & penyimpan rekap dipertahankan)
- Create: `apps/portal/src/components/sukaBot/HalamanAsisten.tsx`
- Modify: `apps/portal/src/app/asisten/page.tsx`, `apps/portal/src/middleware.ts`, `apps/portal/next.config.mjs`

**Interfaces:**
- Consumes: `jepitPosisi`, `posisiAwal`, `posisiPanel`, `ukuranPanel`, `sudahGeser`, `type Titik`, `type Ukuran` (Task 7); `AvatarSukaBot`, `PanelSukaBot` (Task 8); `RASIO` (Task 6).
- Produces: `useUkuranLayar(): Ukuran`, `useGeserChef(ukuran: Ukuran, layar: Ukuran): { posisi: Titik; penangan: PenanganPointer; baruSajaDigeser: () => boolean }`, `HalamanAsisten` default export props `{ apiBase: string }`.

- [ ] **Step 1: Hook geser**

`apps/portal/src/components/sukaBot/useGeserChef.ts`:

```ts
'use client'
import { useEffect, useRef, useState, type PointerEvent as PointerReact } from 'react'
import { jepitPosisi, posisiAwal, sudahGeser, type Titik, type Ukuran } from './avatar/posisi'

const KUNCI_POSISI = 'sukaBot.posisi'

function bacaPosisi(): Titik | null {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_POSISI) || 'null')
    return v && typeof v.x === 'number' && typeof v.y === 'number' ? { x: v.x, y: v.y } : null
  } catch { return null }
}
function simpanPosisi(p: Titik) {
  try { localStorage.setItem(KUNCI_POSISI, JSON.stringify(p)) } catch { /* abaikan */ }
}

/** Ukuran jendela. Hanya untuk komponen yang dirender di klien (widget dimuat dengan ssr:false). */
export function useUkuranLayar(): Ukuran {
  const [layar, setLayar] = useState<Ukuran>(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const ubah = () => setLayar({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', ubah)
    return () => window.removeEventListener('resize', ubah)
  }, [])
  return layar
}

type PenanganPointer = {
  onPointerDown: (e: PointerReact<HTMLElement>) => void
  onPointerMove: (e: PointerReact<HTMLElement>) => void
  onPointerUp: (e: PointerReact<HTMLElement>) => void
  onPointerCancel: (e: PointerReact<HTMLElement>) => void
}

/** Chef digeser dengan pointer (mouse & sentuh), dijepit di dalam layar, posisi diingat per perangkat. */
export function useGeserChef(ukuran: Ukuran, layar: Ukuran): { posisi: Titik; penangan: PenanganPointer; baruSajaDigeser: () => boolean } {
  const [posisi, setPosisi] = useState<Titik>(() => jepitPosisi(bacaPosisi() ?? posisiAwal(ukuran, layar), ukuran, layar))
  const posisiTerkini = useRef(posisi)
  posisiTerkini.current = posisi
  const geser = useRef<{ id: number; awalX: number; awalY: number; asal: Titik; aktif: boolean } | null>(null)
  const digeser = useRef(false)

  useEffect(() => {
    setPosisi((p) => jepitPosisi(p, ukuran, layar))
  }, [ukuran.w, ukuran.h, layar.w, layar.h]) // eslint-disable-line react-hooks/exhaustive-deps

  const selesai = (e: PointerReact<HTMLElement>) => {
    const g = geser.current
    if (!g || g.id !== e.pointerId) return
    geser.current = null
    if (g.aktif) simpanPosisi(posisiTerkini.current)
  }

  const penangan: PenanganPointer = {
    onPointerDown: (e) => {
      if (e.button !== 0) return
      geser.current = { id: e.pointerId, awalX: e.clientX, awalY: e.clientY, asal: posisiTerkini.current, aktif: false }
      digeser.current = false
    },
    onPointerMove: (e) => {
      const g = geser.current
      if (!g || g.id !== e.pointerId) return
      const dx = e.clientX - g.awalX
      const dy = e.clientY - g.awalY
      if (!g.aktif) {
        if (!sudahGeser(dx, dy)) return
        g.aktif = true
        digeser.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      setPosisi(jepitPosisi({ x: g.asal.x + dx, y: g.asal.y + dy }, ukuran, layar))
    },
    onPointerUp: selesai,
    onPointerCancel: selesai,
  }

  /** Dipanggil di onClick: true bila klik ini sebenarnya akhir dari geseran (lalu direset). */
  const baruSajaDigeser = () => {
    const d = digeser.current
    digeser.current = false
    return d
  }

  return { posisi, penangan, baruSajaDigeser }
}
```

- [ ] **Step 2: Widget**

Di `apps/portal/src/components/sukaBot/SukaBotWidget.tsx`:

1. Ganti baris-baris import di atas berkas dengan:

```tsx
'use client'
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import AvatarSukaBot, { type Pose } from './AvatarSukaBot'
import PanelSukaBot from './PanelSukaBot'
import { RASIO } from './avatar/klip.gen'
import { posisiPanel, ukuranPanel } from './avatar/posisi'
import { ambilRekap, type Rekap } from './api'
import { useGeserChef, useUkuranLayar } from './useGeserChef'
```

2. Ganti seluruh fungsi `Widget` dengan:

```tsx
const TINGGI_DESKTOP = 140
const TINGGI_HP = 110

function Widget({ apiBase }: { apiBase: string }) {
  const [buka, setBuka] = useState(false)
  const [adaBaru, setAdaBaru] = useState(false)
  const [posePanel, setPosePanel] = useState<Pose>('rekap')
  const [ketukan, setKetukan] = useState(0)
  const layar = useUkuranLayar()
  const tinggi = layar.w < 640 ? TINGGI_HP : TINGGI_DESKTOP
  const ukuranChef = { w: Math.round(tinggi * RASIO), h: tinggi }
  const { posisi, penangan, baruSajaDigeser } = useGeserChef(ukuranChef, layar)

  useEffect(() => {
    ambilRekap(apiBase).then(({ rekap }) => setAdaBaru(bacaDibaca() !== rekap.id)).catch(() => {})
  }, [apiBase])

  const saatRekap = useCallback((r: Rekap) => { tulisDibaca(r.id); setAdaBaru(false) }, [])

  const pose: Pose = buka ? posePanel : adaBaru ? 'rekap' : 'diam'
  const panel = buka ? posisiPanel({ ...posisi, ...ukuranChef }, ukuranPanel(layar), layar) : null

  return (
    <>
      {panel && (
        <div className="fixed z-50" style={{ left: panel.x, top: panel.y }}>
          <PanelSukaBot apiBase={apiBase} onRekap={saatRekap} onPose={setPosePanel} ukuran={{ w: panel.w, h: panel.h }} />
        </div>
      )}
      <button
        type="button"
        {...penangan}
        onClick={() => {
          if (baruSajaDigeser()) return
          setBuka((b) => !b)
          setKetukan((n) => n + 1)
        }}
        aria-label={buka ? 'Tutup SUKA Bot' : 'Buka SUKA Bot'}
        className="fixed z-50 touch-none cursor-grab active:cursor-grabbing rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-suka-orange"
        style={{ left: posisi.x, top: posisi.y, width: ukuranChef.w, height: ukuranChef.h }}
      >
        <AvatarSukaBot pose={pose} tinggi={tinggi} ketukan={ketukan} />
        {adaBaru && !buka && (
          <span className="absolute flex w-3.5 h-3.5" style={{ top: '3%', right: '18%' }}>
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white" />
          </span>
        )}
      </button>
    </>
  )
}
```

- [ ] **Step 3: Halaman /asisten**

`apps/portal/src/components/sukaBot/HalamanAsisten.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import AvatarSukaBot, { type Pose } from './AvatarSukaBot'
import PanelSukaBot from './PanelSukaBot'

/** Isi /asisten (cek role admin/owner/developer dilakukan di page.tsx sebelum ini dirender). */
export default function HalamanAsisten({ apiBase }: { apiBase: string }) {
  const [pose, setPose] = useState<Pose>('rekap')
  const [ketukan, setKetukan] = useState(0)
  // Default desktop agar render server & klien sama; HP disetel setelah mount.
  const [tinggi, setTinggi] = useState(180)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const atur = () => setTinggi(mq.matches ? 110 : 180)
    atur()
    mq.addEventListener('change', atur)
    return () => mq.removeEventListener('change', atur)
  }, [])

  return (
    <div className="flex flex-col md:flex-row md:items-end gap-4">
      <button type="button" aria-label="SUKA Bot" onClick={() => setKetukan((n) => n + 1)} className="self-center md:self-end shrink-0">
        <AvatarSukaBot pose={pose} tinggi={tinggi} ketukan={ketukan} />
      </button>
      <div className="flex-1 min-w-0">
        <PanelSukaBot apiBase={apiBase} penuh onPose={setPose} />
      </div>
    </div>
  )
}
```

Di `apps/portal/src/app/asisten/page.tsx`: ganti `import PanelSukaBot from '@/components/sukaBot/PanelSukaBot'` dengan `import HalamanAsisten from '@/components/sukaBot/HalamanAsisten'`, ganti `<div className="max-w-3xl mx-auto space-y-4">` dengan `<div className="max-w-4xl mx-auto space-y-4">`, dan ganti `<PanelSukaBot apiBase={apiBase} penuh />` dengan `<HalamanAsisten apiBase={apiBase} />`. **Baris cek role (`redirect('/launcher')`) tidak boleh diubah.**

- [ ] **Step 4: Aset publik & cache**

`apps/portal/src/middleware.ts` — di regex `matcher`, ekstensi statis menjadi `...svg|webp|gif|ico|woff2?|ttf|otf|webm)$` (tambahkan `webm`; tanpa `mp4`).

`apps/portal/next.config.mjs` — di dalam objek `nextConfig`, setelah `typescript: { ignoreBuildErrors: true },`:

```js
  // URL aset avatar memakai sidik (?v=...) dari klip.gen.ts, jadi aman di-cache selamanya.
  async headers() {
    return [
      {
        source: '/suka-bot/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
```

- [ ] **Step 5: Type-check, test, build**

Run (dari `apps/portal`):
```bash
../../node_modules/.bin/tsc --noEmit -p .
../../node_modules/.bin/vitest run
../../node_modules/.bin/next build
```
Expected: tsc tanpa keluaran; 32 test lolos; build sukses.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
S=apps/portal/src/components/sukaBot
git add $S/useGeserChef.ts $S/SukaBotWidget.tsx $S/HalamanAsisten.tsx apps/portal/src/app/asisten/page.tsx apps/portal/src/middleware.ts apps/portal/next.config.mjs
git commit -m "feat(suka-bot): chef bisa digeser, panel ikut chef, chef di halaman asisten

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verifikasi akhir & catatan sesi

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Pemeriksaan otomatis**

Run (root repo):
```bash
python -m unittest discover -s scripts/suka-bot -p "test_*.py"
python scripts/suka-bot/olah_klip.py --periksa
git diff --stat yarn.lock
```
Expected: `OK`, `periksa: OK`, diff lockfile kosong.

- [ ] **Step 2: Server produksi lokal**

Jalankan `../../node_modules/.bin/next start -p 3010` (dari `apps/portal`) di latar, lalu (root repo):
```bash
curl -sI "http://localhost:3010/suka-bot/diam.webm" | grep -i -E "^HTTP|cache-control|content-type"
curl -s -o /dev/null -w "%{http_code}\n" -H "Range: bytes=0-1023" "http://localhost:3010/suka-bot/diam.webm"
curl -sI "http://localhost:3010/suka-bot/diam.anim.webp" | grep -i -E "^HTTP|cache-control"
curl -sI http://localhost:3010/launcher | grep -i -E "^HTTP|location"
curl -sI http://localhost:3010/asisten | grep -i -E "^HTTP|location"
```
Expected: webm `200`, `video/webm`, cache `immutable`; range `206`; anim.webp `200` + `immutable`; `/launcher` & `/asisten` tanpa login → `307` ke `/` (gerbang role tetap). Hentikan server.

- [ ] **Step 3: Uji manual (owner/admin/developer, browser terlihat — panel tersembunyi menunda video)**

`yarn dev` di `apps/portal`, login akun admin/owner/developer:
- [ ] launcher: chef seluruh badan di pojok kanan bawah, tanpa lingkaran; bila ada rekap baru, melambai sekali lalu diam, titik merah berdenyut dekat topi
- [ ] geser chef ke tengah kiri → lepas: panel TIDAK terbuka, chef tidak jempol; muat ulang → chef tetap di posisi itu
- [ ] klik chef → jempol + panel muncul di sisi yang menghadap tengah; kirim pertanyaan → chef berpikir; jawaban → diam
- [ ] geser chef saat panel terbuka → panel ikut
- [ ] DevTools device 375×812 → chef 110 px, panel muncul di atas chef dan tidak menutupinya
- [ ] Windows "Animation effects" OFF → gambar pose saja
- [ ] Safari/iPhone bila tersedia → chef bergerak (WebP)
- [ ] `/asisten` → chef di kiri panel (desktop) / di atas panel (HP), ikut berpikir saat menunggu
- [ ] akun **crew/leader** → widget tidak muncul di launcher, `/asisten` dialihkan ke launcher
- [ ] Console tanpa error merah

- [ ] **Step 4: Catat sesi di CLAUDE.md**

Tambahkan sebelum baris `**Last updated:**` (perbarui tanggalnya):

```markdown
## Session 2026-10-05: SUKA Bot — Avatar Chef Beranimasi (apps/portal)

**Status:** Kode di branch `feat/suka-bot-avatar-animasi`. ⚠️ Perlu merge + **redeploy `portal`**.
**Hanya untuk role admin, owner, developer** (gerbang: `bisaSukaBot` launcher, cek role `/asisten`,
`is_owner_or_admin()` server — jangan dilonggarkan).

**Spec/plan:** `docs/superpowers/specs/2026-10-05-suka-bot-avatar-animasi-design.md` (§11 = revisi
akhir), `docs/superpowers/plans/2026-10-05-suka-bot-avatar-animasi.md`

- Chef seluruh badan, transparan, bisa digeser (posisi diingat), panel muncul di samping chef.
  Klip Google Flow (Veo) per pose: `diam`/`berpikir` berulang, `rekap`/`bingung`/`sapa` sekali.
- Format per perangkat: WebM VP9 alfa (Chromium/Firefox) vs WebP beranimasi 12 fps (semua
  browser iOS + Safari Mac — WebKit tak menggambar alfa WebM). Pemilih: `avatar/modeTampil.ts`.
- **Klip berulang WAJIB dibuat dengan *Frames to Video*** (frame awal = akhir = `chefss.jpeg`).
- Aset = hasil `python scripts/suka-bot/olah_klip.py` (jangan edit tangan); video mentah di Drive
  tim. `--periksa` menjaga loop, frame beku, alfa, sisa hijau, ukuran, sinkron `klip.gen.ts`.
- Gotcha: `chromakey` ffmpeg membuat janggut tembus → kunci dominansi hijau di skrip. Dekoder
  ffmpeg bawaan membuang alfa VP9 → wajib `-c:v libvpx-vp9` sebelum `-i`. Satu kotak potong
  untuk semua klip. Matcher middleware portal dulu tak meloloskan video → redirect 307 ikut
  ter-cache 1 tahun; kini `.webm` diloloskan.
- Panel browser Claude yang tersembunyi menunda video (Chrome "background media paused") —
  bukan bug.
- Portal kini punya Vitest (`yarn test`); `framer-motion`/`vitest` tanpa ubah lockfile.
```

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # harus feat/suka-bot-avatar-animasi
git add CLAUDE.md
git commit -m "docs(suka-bot): catatan sesi avatar chef beranimasi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
