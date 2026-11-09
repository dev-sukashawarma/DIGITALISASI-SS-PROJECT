import Foundation
import Testing
@testable import SukaShawarma

/// Padanan `MenuTerlarisTest.kt` — kasus yang sama persis.
struct MenuTerlarisKurasiTests {
    private let katalog = [
        menuUji("es", "Ice Tea", kategori: "c", urut: 1),
        menuUji("ayam", "Original Ayam Jumbo", kategori: "c", urut: 2),
        menuUji("sapi", "Original Sapi Besar", kategori: "c", urut: 3),
        menuUji("kentang", "Extra Kentang", kategori: "c", urut: 4, tersedia: false),
    ]

    private func ids(_ kurasi: [String], _ semua: [MenuItemDto]? = nil) -> [String] {
        pilihMenuTerlaris(semua ?? katalog, kurasiIds: kurasi).map(\.id)
    }

    @Test func urutanKurasiAdminDipakai() {
        #expect(ids(["sapi", "es", "ayam"]) == ["sapi", "es"])
    }

    @Test func menuHabisAtauTakDijualDilewatiCadanganNaik() {
        #expect(ids(["kentang", "tidak-ada", "ayam", "es"]) == ["ayam", "es"])
    }

    @Test func kurasiKosongMemakaiAturanLama() {
        #expect(ids([]) == ["ayam", "sapi"])
    }

    @Test func semuaPilihanAdminHabisJugaMemakaiAturanLama() {
        #expect(ids(["kentang"]) == ["ayam", "sapi"])
    }

    @Test func aturanLamaTanpaAyamSapiAmbilTersediaPertama() {
        let lain = [menuUji("a", "Kopi", kategori: "c", urut: 1),
                    menuUji("b", "Teh", kategori: "c", urut: 2, tersedia: false),
                    menuUji("c", "Susu", kategori: "c", urut: 3)]
        #expect(ids([], lain) == ["a", "c"])
    }

    @Test func kurasiSatuTersediaTetapSatuTakDicampurAturanLama() {
        #expect(ids(["es", "kentang"]) == ["es"])
    }

    @Test func configMembacaMenuTerlarisIds() throws {
        let json = #"{"estimasi_siap":"10 menit","menu_terlaris_ids":["sapi","es"]}"#
        let c = try JSONDecoder().decode(ConfigDto.self, from: Data(json.utf8))
        #expect(c.menuTerlarisIds == ["sapi", "es"])
        let kosong = try JSONDecoder().decode(ConfigDto.self, from: Data("{}".utf8))
        #expect(kosong.menuTerlarisIds.isEmpty)
    }
}
