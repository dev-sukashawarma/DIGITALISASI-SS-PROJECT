import Testing
@testable import SukaShawarma

@MainActor
struct ItemDetailViewModelTests {
    /// Teks bagikan sama persis dengan `ItemDetailScreen.kt` (15 Okt).
    @Test func teksBagikanMenu() {
        #expect(SukaShawarma.teksBagikanMenu(menuUji("a", "Shawarma Ayam", kategori: nil, urut: nil, harga: 25000))
                == "Cobain Shawarma Ayam (Rp25.000) di Suka Shawarma!")
        #expect(SukaShawarma.teksBagikanMenu(menuUji("a", "Kebab", kategori: nil, urut: nil, deskripsi: "Pedas", harga: 18000))
                == "Cobain Kebab (Rp18.000) di Suka Shawarma!\nPedas")
        #expect(SukaShawarma.teksBagikanMenu(menuUji("a", "Kebab", kategori: nil, urut: nil, deskripsi: "  ", harga: 18000))
                == "Cobain Kebab (Rp18.000) di Suka Shawarma!")
    }

    @Test func jumlahDibatasi1Sampai99() {
        let vm = ItemDetailViewModel()
        vm.ubahJumlah(-5)
        #expect(vm.jumlah == 1)
        vm.ubahJumlah(500)
        #expect(vm.jumlah == 99)
    }

    @Test func catatanDipotongSaatDiketik() {
        let vm = ItemDetailViewModel()
        vm.catatan = String(repeating: "x", count: 250)
        #expect(vm.catatan.count == 200)
    }

    @Test func toppingBisaDipilihDanDibatalkan() {
        let vm = ItemDetailViewModel()
        vm.toggleTopping("t1"); vm.toggleTopping("t2"); vm.toggleTopping("t1")
        #expect(vm.toppingTerpilih == ["t2"])
    }
}
