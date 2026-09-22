import Foundation
import Testing
@testable import SukaShawarma

/// Porting `ValidasiPesanTest.kt` (9/9).
struct ValidasiPesanTests {
    private func masalah(_ nama: String, _ jenis: String, harga: Double? = nil) -> CartProblemDto {
        CartProblemDto(menuItemId: "m1", name: nama, jenis: jenis, hargaBaru: harga)
    }

    @Test func habisDenganNama() {
        let p = pesanUntukMasalah(masalah("Shawarma Ayam Original", "habis"))
        #expect(p.contains("Shawarma Ayam Original") && p.contains("habis"))
    }

    @Test func hargaBerubahMenyebutHargaBaru() {
        #expect(pesanUntukMasalah(masalah("Shawarma", "harga_berubah", harga: 28000)).contains("28.000"))
    }

    @Test func hargaBerubahTanpaAngkaTetapUtuh() {
        let p = pesanUntukMasalah(masalah("Shawarma Ayam Original", "harga_berubah"))
        #expect(p.contains("Shawarma Ayam Original") && !p.contains("nil") && !p.contains("null"))
    }

    @Test func tidakAdaTanpaIstilahTeknis() {
        let p = pesanUntukMasalah(masalah("Menu Lama", "tidak_ada"))
        #expect(p.contains("Menu Lama") && !p.contains("tidak_ada"))
    }

    @Test func jenisTakDikenalTetapKalimat() {
        let p = pesanUntukMasalah(masalah("Sesuatu", "jenis_baru"))
        #expect(!p.trimmingCharacters(in: .whitespaces).isEmpty && !p.contains("jenis_baru"))
    }

    @Test func hanyaHargaBerubahMenawarkanHargaBaru() {
        #expect(labelTindakan(masalah("A", "harga_berubah", harga: 1000)) == "Pakai harga baru")
        #expect(labelTindakan(masalah("A", "habis")) == "Hapus dari keranjang")
        #expect(labelTindakan(masalah("A", "tidak_ada")) == "Hapus dari keranjang")
    }

    @Test func alasanDiterjemahkan() {
        #expect(pesanUntukAlasan("outlet_tutup", pesanDariGateway: nil).contains("tutup"))
        #expect(!pesanUntukAlasan("outlet_tidak_melayani", pesanDariGateway: nil).contains("_"))
    }

    @Test func alasanTakDikenalPakaiKalimatGateway() {
        #expect(pesanUntukAlasan("alasan_baru", pesanDariGateway: "Outlet ini belum melayani pesanan aplikasi")
                == "Outlet ini belum melayani pesanan aplikasi")
    }

    @Test func alasanTakDikenalTanpaKalimatGateway() {
        #expect(!pesanUntukAlasan(nil, pesanDariGateway: nil).isEmpty)
    }
}

/// Bentuk payload ke gateway (di Android tersirat, tanpa uji).
struct PayloadKeranjangTests {
    @Test func toppingJadiBarisSendiriDenganJumlahItemUtama() {
        let baris = CartLine(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: "Pedas",
                             toppings: [CartTopping(menuItemId: "t1", nama: "Extra Keju", hargaSatuan: 7000)])
        let p = baris.kePayloadList()
        #expect(p.count == 2)
        #expect(p[0] == CartItemPayload(menuItemId: "m1", name: "Shawarma", unitPrice: 25000, quantity: 2, note: "Pedas"))
        #expect(p[1] == CartItemPayload(menuItemId: "t1", name: "Extra Keju", unitPrice: 7000, quantity: 2, note: "Topping Shawarma"))
    }
}
