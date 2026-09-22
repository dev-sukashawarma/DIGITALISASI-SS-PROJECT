import Testing
@testable import SukaShawarma

func menuUji(_ id: String, _ nama: String, kategori: String?, urut: Int?, tersedia: Bool = true,
             namaKategori: String? = nil, urutKategori: Int? = nil, deskripsi: String? = nil,
             harga: Double = 25000) -> MenuItemDto {
    MenuItemDto(id: id, name: nama, description: deskripsi, price: harga, imageUrl: nil, isAvailable: tersedia,
                categoryId: kategori, sortOrder: urut, categoryName: namaKategori, categorySortOrder: urutKategori)
}

/// Porting `KatalogFilterTest.kt` (11/11 kasus).
struct KatalogFilterTests {
    @Test func kelompokPerKategoriUrutSortOrder() {
        let h = kelompokkanPerKategori([
            menuUji("b", "Kebab Mini", kategori: "c1", urut: 2),
            menuUji("a", "Shawarma Ayam Original", kategori: "c1", urut: 1),
            menuUji("c", "Es Teh Manis", kategori: "c2", urut: 1),
        ])
        #expect(h.count == 2)
        #expect(h[0].items.map(\.id) == ["a", "b"])
    }

    @Test func tanpaKategoriMasukLainnya() {
        let h = kelompokkanPerKategori([menuUji("a", "Tanpa kategori", kategori: nil, urut: 1)])
        #expect(h.count == 1 && h[0].items.count == 1 && h[0].nama == "Lainnya")
    }

    @Test func itemHabisTetapTampil() {
        #expect(kelompokkanPerKategori([menuUji("a", "Habis", kategori: "c1", urut: 1, tersedia: false)]).count == 1)
    }

    @Test func sortOrderNilDiAkhir() {
        let h = kelompokkanPerKategori([menuUji("a", "Tanpa urutan", kategori: "c1", urut: nil),
                                        menuUji("b", "Punya urutan", kategori: "c1", urut: 1)])
        #expect(h[0].items.map(\.id) == ["b", "a"])
    }

    @Test func kelompokIkutSortOrderKategori() {
        let h = kelompokkanPerKategori([
            menuUji("a", "Es Teh", kategori: "c2", urut: 1, namaKategori: "Minuman", urutKategori: 2),
            menuUji("b", "Shawarma", kategori: "c1", urut: 1, namaKategori: "Makanan", urutKategori: 1),
        ])
        #expect(h.map(\.nama) == ["Makanan", "Minuman"])
    }

    @Test func lainnyaSelaluPalingBawah() {
        let h = kelompokkanPerKategori([
            menuUji("a", "Tanpa kategori", kategori: nil, urut: 1),
            menuUji("b", "Shawarma", kategori: "c1", urut: 1, namaKategori: "Makanan", urutKategori: 9),
        ])
        #expect(h.map(\.nama) == ["Makanan", "Lainnya"])
    }

    @Test func kategoriTanpaNamaTakMenghilangkanItem() {
        let h = kelompokkanPerKategori([menuUji("a", "Shawarma", kategori: "c1", urut: 1)])
        #expect(h.count == 1 && h[0].items.map(\.id) == ["a"] && h[0].nama == "Menu")
    }

    @Test func pencarianNamaTanpaPeduliHuruf() {
        let semua = [menuUji("a", "Shawarma Ayam Original", kategori: "c1", urut: 1),
                     menuUji("b", "Es Teh Manis", kategori: "c2", urut: 1)]
        #expect(saringPencarian(semua, kueri: "shawarma").map(\.id) == ["a"])
        #expect(saringPencarian(semua, kueri: "  AYAM ").map(\.id) == ["a"])
    }

    @Test func pencarianDeskripsi() {
        let semua = [menuUji("a", "Paket Hemat", kategori: "c1", urut: 1, deskripsi: "Ayam panggang dan saus khas"),
                     menuUji("b", "Es Teh Manis", kategori: "c2", urut: 1)]
        #expect(saringPencarian(semua, kueri: "panggang").map(\.id) == ["a"])
    }

    @Test func kueriKosongSemua() {
        let semua = [menuUji("a", "Shawarma", kategori: "c1", urut: 1), menuUji("b", "Es Teh", kategori: "c2", urut: 1)]
        #expect(saringPencarian(semua, kueri: "").count == 2)
        #expect(saringPencarian(semua, kueri: "   ").count == 2)
    }

    @Test func kueriTanpaHasilKosong() {
        #expect(saringPencarian([menuUji("a", "Shawarma", kategori: "c1", urut: 1)], kueri: "nasi goreng").isEmpty)
    }

    @Test func urutanStabilSaatSemuaUrutanNil() {
        let data = [menuUji("x", "B", kategori: "k2", urut: nil), menuUji("y", "A", kategori: "k1", urut: nil)]
        #expect(kelompokkanPerKategori(data).map(\.id) == ["k2", "k1"])
        #expect(kelompokkanPerKategori(data) == kelompokkanPerKategori(data))
    }
}

/// Logika topping dari `AppNavigation.kt` (tak ada uji Android-nya).
struct ToppingTests {
    private let semua = [
        menuUji("m", "Shawarma", kategori: "c1", urut: 1, namaKategori: "Shawarma"),
        menuUji("t1", "Extra Keju", kategori: "t", urut: 1, namaKategori: "Topping"),
        menuUji("t2", "Extra Kentang", kategori: "t", urut: 2, tersedia: false, namaKategori: "topping"),
        menuUji("d", "Es Teh", kategori: "d", urut: 1, namaKategori: "Suka Drink"),
    ]

    @Test func menuBiasaDapatToppingTersedia() {
        #expect(toppingUntuk(semua[0], semua: semua).map(\.id) == ["t1"])
    }

    @Test func toppingDanMinumanTakDapatTopping() {
        #expect(toppingUntuk(semua[1], semua: semua).isEmpty)
        #expect(toppingUntuk(semua[3], semua: semua).isEmpty)
    }
}
