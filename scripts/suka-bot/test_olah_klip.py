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
