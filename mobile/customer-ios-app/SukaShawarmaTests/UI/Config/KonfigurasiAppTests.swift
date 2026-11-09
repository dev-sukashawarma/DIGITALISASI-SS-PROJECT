import Foundation
import Testing
@testable import SukaShawarma

/// Porting `KonfigurasiAppTest.kt` + `TautanAppTest.kt`, plus kontrak `/api/v1/config`.
struct KonfigurasiAppTests {
    @Test func versiDiBawahMinimumWajibUpdate() {
        #expect(perluUpdate(versiTerpasang: 1, config: ConfigDto(versiMinimumIos: 2)))
    }
    @Test func versiSamaAtauLebihTinggiTidak() {
        #expect(!perluUpdate(versiTerpasang: 2, config: ConfigDto(versiMinimumIos: 2)))
        #expect(!perluUpdate(versiTerpasang: 3, config: ConfigDto(versiMinimumIos: 2)))
    }
    @Test func configGagalDimuatTidakMengunci() { #expect(!perluUpdate(versiTerpasang: 1, config: nil)) }

    /// Gateway hari ini hanya mengirim `versi_minimum_android` — iOS tak boleh ikut terkunci karenanya.
    @Test func versiMinimumAndroidTidakMengunciIos() throws {
        let c = try JSONDecoder().decode(ConfigDto.self, from: Data(#"""
        {"estimasi_siap":"10–15 menit","wa_cs":"6285283524708","versi_minimum_android":99,
         "url_syarat":null,"url_privasi":null}
        """#.utf8))
        #expect(c.estimasiSiap == "10–15 menit")
        #expect(c.waCs == "6285283524708")
        #expect(c.versiMinimumIos == nil)
        #expect(!perluUpdate(versiTerpasang: 1, config: c))
    }

    @Test func configKosongPakaiBawaan() throws {
        let c = try JSONDecoder().decode(ConfigDto.self, from: Data("{}".utf8))
        #expect(c == ConfigDto())
        #expect(c.estimasiSiap == "15–20 menit")
    }

    @Test func waKosongTidakMenampilkanTautan() {
        #expect(tautanWa(nil, teks: "Halo") == nil)
        #expect(tautanWa("  ", teks: "Halo") == nil)
    }
    @Test func teksWaDiEncode() {
        #expect(tautanWa("6281234567890", teks: "Pesanan #12")?.absoluteString
                == "https://wa.me/6281234567890?text=Pesanan%20%2312")
    }
    /// Padanan `urlKebijakanPrivasi`/`urlSyaratKetentuan` (TautanApp.kt, 15 Okt).
    @Test func privasiDanSyaratJatuhKeHalamanGateway() {
        let base = URL(string: "https://retail.sukashawarma.com")!
        #expect(urlKebijakanPrivasi(nil, baseURL: base).absoluteString == "https://retail.sukashawarma.com/privasi")
        #expect(urlSyaratKetentuan("  ", baseURL: base).absoluteString == "https://retail.sukashawarma.com/syarat")
        let garisMiring = URL(string: "https://gateway.uji/")!
        #expect(urlKebijakanPrivasi(nil, baseURL: garisMiring).absoluteString == "https://gateway.uji/privasi")
    }
    @Test func privasiDanSyaratAdminDidahulukan() {
        let base = URL(string: "https://retail.sukashawarma.com")!
        #expect(urlKebijakanPrivasi(" https://sukashawarma.com/privasi ", baseURL: base).absoluteString
                == "https://sukashawarma.com/privasi")
        #expect(urlSyaratKetentuan("https://sukashawarma.com/syarat", baseURL: base).absoluteString
                == "https://sukashawarma.com/syarat")
        // Bukan tautan web → halaman resmi, bukan tombol yang gagal dibuka.
        #expect(urlSyaratKetentuan("javascript:alert(1)", baseURL: base).path == "/syarat")
    }
    @Test func tautanWebHanyaHttp() {
        #expect(tautanWeb("https://sukashawarma.com/syarat")?.host == "sukashawarma.com")
        #expect(tautanWeb("javascript:alert(1)") == nil)
        #expect(tautanWeb("") == nil)
        #expect(tautanWeb(nil) == nil)
    }
}
