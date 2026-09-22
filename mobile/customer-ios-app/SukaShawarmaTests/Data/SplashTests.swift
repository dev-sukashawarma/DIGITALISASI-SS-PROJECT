import Foundation
import Testing
@testable import SukaShawarma

/// Porting `KeputusanSplashTest.kt` (7/7).
struct KeputusanSplashTests {
    @Test func durasiDibatasi1Sampai5Detik() {
        #expect(KeputusanSplash.batasiDurasi(10) == 1_000)
        #expect(KeputusanSplash.batasiDurasi(60_000) == 5_000)
        #expect(KeputusanSplash.batasiDurasi(2_000) == 2_000)
    }

    @Test func durasiKosongJatuhKe3Detik() {
        #expect(KeputusanSplash.batasiDurasi(nil) == 3_000)
        #expect(KeputusanSplash.batasiDurasi(0) == 3_000)
        #expect(KeputusanSplash.batasiDurasi(-500) == 3_000)
    }

    @Test func unduhSaatGambarBaru() {
        #expect(KeputusanSplash.perluUnduh(urlServer: "https://x/b.webp", urlTersimpan: "https://x/a.webp", berkasAda: true))
        #expect(KeputusanSplash.perluUnduh(urlServer: "https://x/a.webp", urlTersimpan: nil, berkasAda: false))
    }

    @Test func takUnduhUlangGambarSama() {
        #expect(!KeputusanSplash.perluUnduh(urlServer: "https://x/a.webp", urlTersimpan: "https://x/a.webp", berkasAda: true))
    }

    @Test func unduhUlangBilaBerkasHilang() {
        #expect(KeputusanSplash.perluUnduh(urlServer: "https://x/a.webp", urlTersimpan: "https://x/a.webp", berkasAda: false))
    }

    @Test func takUnduhSaatGambarBawaan() {
        #expect(!KeputusanSplash.perluUnduh(urlServer: nil, urlTersimpan: "https://x/a.webp", berkasAda: true))
    }

    @Test func hapusHanyaSaatGambarBawaan() {
        #expect(KeputusanSplash.perluHapus(urlServer: nil, urlTersimpan: "https://x/a.webp"))
        #expect(!KeputusanSplash.perluHapus(urlServer: nil, urlTersimpan: nil))
        #expect(!KeputusanSplash.perluHapus(urlServer: "https://x/a.webp", urlTersimpan: "https://x/a.webp"))
    }
}

/// Penyimpanan splash & banner-dilihat (tanpa padanan uji di Android).
struct SplashStoreTests {
    private func store() -> (SplashStore, () -> Void) {
        let suite = "uji-splash-\(UUID().uuidString)"
        let folder = FileManager.default.temporaryDirectory.appending(path: suite)
        let d = UserDefaults(suiteName: suite)!
        return (SplashStore(defaults: d, folder: folder), {
            d.removePersistentDomain(forName: suite)
            try? FileManager.default.removeItem(at: folder)
        })
    }

    @Test func simpanDanHapusGambar() {
        let (s, bersih) = store(); defer { bersih() }
        #expect(s.dataGambar() == nil)
        #expect(s.durasiMs() == 3_000)

        s.simpanDurasi(60_000)
        #expect(s.durasiMs() == 5_000)

        s.simpanGambar(url: "https://x/a.jpg", data: Data("GAMBAR".utf8))
        #expect(s.urlTersimpan() == "https://x/a.jpg")
        #expect(s.berkasAda())
        #expect(s.dataGambar() == Data("GAMBAR".utf8))

        s.hapusGambar()
        #expect(s.urlTersimpan() == nil)
        #expect(!s.berkasAda())
        #expect(s.dataGambar() == nil)
    }

    @Test func bannerDilihatBertambah() {
        let suite = "uji-banner-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        defer { d.removePersistentDomain(forName: suite) }
        let s = BannerDilihatStore(defaults: d)
        #expect(s.sudahDilihat().isEmpty)
        s.tandai("b1"); s.tandai("b2"); s.tandai("b1")
        #expect(s.sudahDilihat() == ["b1", "b2"])
    }
}
