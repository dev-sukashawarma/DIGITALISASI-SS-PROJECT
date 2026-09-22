import Testing
@testable import SukaShawarma

/// Porting `OutletPickerLogicTest.kt` (5/5).
struct OutletPickerLogicTests {
    private func outlet(_ id: String, _ nama: String, alamat: String? = nil, aktif: Bool = true) -> OutletDto {
        OutletDto(id: id, name: nama, address: alamat, lat: nil, lng: nil, isActive: aktif)
    }

    @Test func bukaDiAtas() {
        let h = urutkanOutlet([outlet("a", "Antapani", aktif: false), outlet("b", "Bantarjati")])
        #expect(h.map(\.id) == ["b", "a"])
    }

    @Test func statusSamaAlfabetis() {
        let h = urutkanOutlet([outlet("c", "Cibubur"), outlet("a", "Antapani"), outlet("b", "Bantarjati")])
        #expect(h.map(\.name) == ["Antapani", "Bantarjati", "Cibubur"])
    }

    @Test func cariNamaMaupunAlamat() {
        let semua = [outlet("a", "Suka Shawarma Empang", alamat: "Jl. Empang Raya No. 24, Bogor Selatan"),
                     outlet("b", "Suka Shawarma Cibubur", alamat: "Jl. Alternatif Cibubur KM 3, Depok")]
        #expect(saringOutlet(semua, kueri: "empang").map(\.id) == ["a"])
        #expect(saringOutlet(semua, kueri: "Depok").map(\.id) == ["b"])
    }

    @Test func tanpaAlamatTakCrash() {
        let semua = [outlet("a", "Suka Shawarma Empang")]
        #expect(saringOutlet(semua, kueri: "bogor").isEmpty)
        #expect(saringOutlet(semua, kueri: "empang").count == 1)
    }

    @Test func kueriKosongSemua() {
        #expect(saringOutlet([outlet("a", "Empang"), outlet("b", "Cibubur")], kueri: "   ").count == 2)
    }
}

/// Porting `TujuanBannerTest.kt` (8/8).
struct TujuanBannerTests {
    @Test func aksiTakDikenal() { #expect(tujuanBanner(aksi: "buka_url", targetMenuItemId: nil) == .tidakAda) }
    @Test func aksiMenu() { #expect(tujuanBanner(aksi: "menu", targetMenuItemId: nil) == .menu) }
    @Test func menuItemTanpaTarget() {
        #expect(tujuanBanner(aksi: "menu_item", targetMenuItemId: nil) == .tidakAda)
        #expect(tujuanBanner(aksi: "menu_item", targetMenuItemId: "  ") == .tidakAda)
    }
    @Test func menuItemDenganTarget() { #expect(tujuanBanner(aksi: "menu_item", targetMenuItemId: "m1") == .item(menuItemId: "m1")) }
    @Test func popupTanpaId() { #expect(!popupBolehTampil(popupId: nil, sudahDilihat: [])) }
    @Test func popupBaru() { #expect(popupBolehTampil(popupId: "b1", sudahDilihat: [])) }
    @Test func popupSudahDilihat() { #expect(!popupBolehTampil(popupId: "b1", sudahDilihat: ["b1"])) }
    @Test func popupBerbeda() { #expect(popupBolehTampil(popupId: "b2", sudahDilihat: ["b1"])) }
}

/// Kurasi best seller — di Android tertanam di HomeScreen tanpa uji.
struct MenuTerlarisTests {
    @Test func satuPerKataKunciYangTersedia() {
        let semua = [menuUji("s0", "Original Sapi", kategori: "c", urut: 1, tersedia: false),
                     menuUji("a", "Original Ayam", kategori: "c", urut: 1),
                     menuUji("s", "Sapi Jumbo", kategori: "c", urut: 1),
                     menuUji("a2", "Ayam Jumbo", kategori: "c", urut: 1)]
        #expect(pilihMenuTerlaris(semua).map(\.id) == ["a", "s"])
    }

    @Test func menuYangCocokDuaKataTakDobel() {
        let semua = [menuUji("x", "Mix Ayam Sapi", kategori: "c", urut: 1)]
        #expect(pilihMenuTerlaris(semua).map(\.id) == ["x"])
    }

    @Test func tanpaKecocokanAmbilDuaTersediaPertama() {
        let semua = [menuUji("1", "Es Teh", kategori: "c", urut: 1, tersedia: false),
                     menuUji("2", "Kentang", kategori: "c", urut: 1),
                     menuUji("3", "Keju", kategori: "c", urut: 1),
                     menuUji("4", "Air", kategori: "c", urut: 1)]
        #expect(pilihMenuTerlaris(semua).map(\.id) == ["2", "3"])
        #expect(pilihMenuTerlaris([]).isEmpty)
    }
}
