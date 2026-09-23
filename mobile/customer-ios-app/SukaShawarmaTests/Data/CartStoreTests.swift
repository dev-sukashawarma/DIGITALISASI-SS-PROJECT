import Testing
@testable import SukaShawarma

/// Porting `CartStoreTest.kt` — setiap uji Android punya padanan di sini.
@MainActor
struct CartStoreTests {
    private func keranjang() -> CartStore { .diMemori() }

    @Test func itemSamaTanpaCatatanDigabung() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma Ayam Original", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.tambah(menuItemId: "m1", nama: "Shawarma Ayam Original", hargaSatuan: 25000, jumlah: 2, catatan: nil)
        #expect(k.isi().count == 1)
        #expect(k.isi()[0].jumlah == 3)
    }

    @Test func catatanBerbedaBarisTerpisah() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: "Jangan pedas")
        #expect(k.isi().count == 2)
    }

    @Test func kurangiSampaiNolMenghapusBaris() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.ubahJumlah(index: 0, delta: -1)
        #expect(k.isi().isEmpty)
    }

    @Test func jumlahTakPernahLebihDari99() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 99, catatan: nil)
        k.ubahJumlah(index: 0, delta: 1)
        #expect(k.isi()[0].jumlah == 99)
    }

    @Test func penggabunganPunTakMelewati99() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 60, catatan: nil)
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 60, catatan: nil)
        #expect(k.isi()[0].jumlah == 99)
    }

    @Test func subtotalHargaKaliJumlah() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: nil)
        k.tambah(menuItemId: "m2", nama: "Es Teh Manis", hargaSatuan: 8000, jumlah: 1, catatan: nil)
        #expect(k.subtotal() == 58000)
        #expect(k.jumlahPorsi() == 3)
    }

    @Test func indeksLuarJangkauanDiabaikan() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.ubahJumlah(index: 5, delta: 1)
        k.hapus(index: -1)
        #expect(k.isi().count == 1)
    }

    @Test func pindahOutletMengosongkanDanMelapor() {
        let k = keranjang()
        k.pakaiOutlet("outlet-a")
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        #expect(k.pakaiOutlet("outlet-b"))
        #expect(k.isi().isEmpty)
        #expect(k.outletId() == "outlet-b")
    }

    @Test func outletSamaTakMengosongkan() {
        let k = keranjang()
        k.pakaiOutlet("outlet-a")
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        #expect(!k.pakaiOutlet("outlet-a"))
        #expect(k.isi().count == 1)
    }

    @Test func pindahOutletKeranjangKosongTakMelapor() {
        let k = keranjang()
        k.pakaiOutlet("outlet-a")
        #expect(!k.pakaiOutlet("outlet-b"))
    }

    @Test func catatanDipotong200() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1,
                 catatan: String(repeating: "x", count: 500))
        #expect(k.isi()[0].catatan?.count == 200)
    }

    @Test func catatanKosongJadiNil() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: "   ")
        #expect(k.isi()[0].catatan == nil)
    }

    @Test func penandaNoteDibersihkan() {
        #expect(rapikanCatatan("|NOTE|Jangan pedas") == "Jangan pedas")
    }

    @Test func bertahanLintasPeluncuran() {
        let simpanan = PenyimpanPalsu()
        let pertama = CartStore(penyimpan: simpanan)
        pertama.pakaiOutlet("outlet-a")
        pertama.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: "Jangan pedas")

        let kedua = CartStore(penyimpan: simpanan)
        #expect(kedua.isi().count == 1)
        #expect(kedua.isi()[0].jumlah == 2)
        #expect(kedua.isi()[0].catatan == "Jangan pedas")
        #expect(kedua.outletId() == "outlet-a")
    }

    @Test func penyimpananRusakJadiKosong() {
        let simpanan = PenyimpanPalsu()
        simpanan.isi = "{ bukan json"
        #expect(CartStore(penyimpan: simpanan).isi().isEmpty)
    }

    @Test func hapusMenuMembuangSemuaBarisnya() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: "Jangan pedas")
        k.tambah(menuItemId: "m2", nama: "Es Teh", hargaSatuan: 8000, jumlah: 1, catatan: nil)
        k.hapusMenuItem("m1")
        #expect(k.isi().count == 1)
        #expect(k.isi()[0].menuItemId == "m2")
    }

    @Test func perbaruiHargaMengenaiSemuaBaris() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: "Jangan pedas")
        k.perbaruiHarga(menuItemId: "m1", hargaBaru: 28000)
        #expect(k.isi().allSatisfy { $0.hargaSatuan == 28000 })
        #expect(k.subtotal() == 84000)
    }

    @Test func perbaruiHargaTakMenyentuhMenuLain() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.tambah(menuItemId: "m2", nama: "Es Teh", hargaSatuan: 8000, jumlah: 1, catatan: nil)
        k.perbaruiHarga(menuItemId: "m1", hargaBaru: 28000)
        #expect(k.isi().first { $0.menuItemId == "m2" }?.hargaSatuan == 8000)
    }

    @Test func hapusMenuTakAdaTakMengubah() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        k.hapusMenuItem("entah")
        #expect(k.isi().count == 1)
    }

    private let keju = CartTopping(menuItemId: "top-keju", nama: "Extra Keju", hargaSatuan: 7000)
    private let kentang = CartTopping(menuItemId: "top-kentang", nama: "Extra Kentang", hargaSatuan: 9000)

    @Test func toppingIkutSubtotal() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma Ayam", hargaSatuan: 25000, jumlah: 2, catatan: nil,
                 toppings: [keju, kentang])
        #expect(k.isi().count == 1)
        #expect(k.isi()[0].toppings.count == 2)
        #expect(k.subtotal() == 82000) // (25.000 + 7.000 + 9.000) × 2
    }

    @Test func hapusToppingMengurangiSubtotal() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma Ayam", hargaSatuan: 25000, jumlah: 1, catatan: nil,
                 toppings: [keju, kentang])
        #expect(k.subtotal() == 41000)
        k.hapusTopping(index: 0, toppingMenuItemId: "top-kentang")
        #expect(k.isi()[0].toppings.map(\.menuItemId) == ["top-keju"])
        #expect(k.subtotal() == 32000)
    }

    @Test func toppingSamaDigabung() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil, toppings: [keju])
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: nil, toppings: [keju])
        #expect(k.isi().count == 1)
        #expect(k.isi()[0].jumlah == 3)
        #expect(k.subtotal() == 96000)
    }

    @Test func toppingBerbedaBarisTerpisah() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil, toppings: [keju])
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil, toppings: [kentang])
        #expect(k.isi().count == 2)
        #expect(k.isi()[0].toppings[0].menuItemId == "top-keju")
        #expect(k.isi()[1].toppings[0].menuItemId == "top-kentang")
    }

    @Test func hapusMenuItemIkutMembuangTopping() {
        let k = keranjang()
        k.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil, toppings: [keju])
        k.hapusMenuItem("top-keju")
        #expect(k.isi().count == 1)
        #expect(k.isi()[0].toppings.isEmpty)
        #expect(k.subtotal() == 25000)
    }
}

private final class PenyimpanPalsu: CartPersistence {
    var isi: String?
    func muat() -> String? { isi }
    func simpan(_ isi: String) { self.isi = isi }
}
