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
