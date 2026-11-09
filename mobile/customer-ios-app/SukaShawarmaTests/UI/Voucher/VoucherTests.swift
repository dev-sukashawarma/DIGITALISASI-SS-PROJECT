import Foundation
import Testing
@testable import SukaShawarma

/// Porting `VoucherDtoTest.kt` + `CartStoreVoucherTest.kt` + `VoucherCheckoutTest.kt`
/// + `VoucherViewModelTest.kt`, ditambah uji perilaku checkout & pembayaran dengan voucher.
struct VoucherDtoTests {
    @Test func requestTanpaVoucherTakMengirimFieldVoucher() throws {
        let teks = String(data: try JSONEncoder().encode(CheckoutValidateRequest(outletId: "o1", items: [])), encoding: .utf8)!
        #expect(!teks.contains("voucher"))
    }

    @Test func blokVoucherValidateTerbaca() throws {
        let r = try JSONDecoder().decode(CheckoutValidateResponse.self, from: Data(#"""
        {"ok":true,"subtotal":40000,"discountAmount":10000,"total":30000,
         "voucher":{"id":"v1","nama":"Uji","status":"berlaku","potongan":10000,
         "item_gratis":[{"menu_item_id":"M","name":"Es Teh","unit_price":10000,"quantity":1,"note":"Gratis voucher"}]}}
        """#.utf8))
        #expect(r.voucher?.status == "berlaku")
        #expect(r.voucher?.itemGratis.first?.name == "Es Teh")
    }

    @Test func daftarVoucherTerbaca() throws {
        let r = try JSONDecoder().decode(VouchersResponse.self, from: Data(#"""
        {"vouchers":[{"id":"v1","nama":"Uji","jenis":"persen","kalimat_syarat":"Potongan 10%","status":"belum","alasan":"Sudah kamu pakai"}]}
        """#.utf8))
        #expect(r.vouchers.first?.alasan == "Sudah kamu pakai")
        #expect(r.vouchers.first?.bolehDipakai == false)
    }

    @Test func blokTanpaPotonganDanItemGratisPakaiBawaan() throws {
        let b = try JSONDecoder().decode(VoucherCheckoutDto.self, from: Data(#"{"status":"belum"}"#.utf8))
        #expect(b.potongan == 0 && b.itemGratis.isEmpty)
    }
}

private final class PenyimpanMemori: CartPersistence {
    var isi: String?
    func muat() -> String? { isi }
    func simpan(_ isi: String) { self.isi = isi }
}

@MainActor
struct CartStoreVoucherTests {
    @Test func voucherBertahanLintasPeluncuran() {
        let p = PenyimpanMemori()
        CartStore(penyimpan: p).pasangVoucher(PilihanVoucher(id: "v1", nama: "Hemat"))
        #expect(CartStore(penyimpan: p).voucher() == PilihanVoucher(id: "v1", nama: "Hemat"))
    }

    @Test func kosongkanIkutMelepasVoucher() {
        let c = CartStore.diMemori()
        c.pasangVoucher(PilihanVoucher(kode: "HEMAT", nama: "HEMAT"))
        c.kosongkan()
        #expect(c.voucher() == nil)
    }

    @Test func lepasVoucher() {
        let c = CartStore.diMemori()
        c.pasangVoucher(PilihanVoucher(id: "v1", nama: "Hemat"))
        c.lepasVoucher()
        #expect(c.voucher() == nil)
    }

    @Test func keranjangLamaTanpaFieldVoucherTetapTerbaca() {
        let p = PenyimpanMemori()
        p.isi = #"{"outletId":"o1","baris":[]}"#
        #expect(CartStore(penyimpan: p).voucher() == nil)
        #expect(CartStore(penyimpan: p).outletId() == "o1")
    }

    @Test func pindahOutletTidakMelepasVoucher() {
        let c = CartStore.diMemori()
        c.pakaiOutlet("a")
        c.pasangVoucher(PilihanVoucher(id: "v1", nama: "Diskon"))
        c.pakaiOutlet("b")
        #expect(c.voucher()?.id == "v1")
    }
}

struct VoucherCheckoutTests {
    private let pilih = PilihanVoucher(id: "v1", nama: "Hemat")

    @Test func tanpaVoucherTakMengunci() { #expect(alasanKunciVoucher(nil, nil) == nil) }
    @Test func berlakuTakMengunci() {
        #expect(alasanKunciVoucher(pilih, VoucherCheckoutDto(id: "v1", status: "berlaku", potongan: 5000)) == nil)
    }
    @Test func belumBerlakuMengunciDenganAlasanGateway() {
        #expect(alasanKunciVoucher(pilih, VoucherCheckoutDto(id: "v1", status: "belum", alasan: "Kurang Rp12.000 lagi"))
                == "Kurang Rp12.000 lagi")
    }
    @Test func terpasangTanpaBlokMengunci() {
        #expect(alasanKunciVoucher(pilih, nil) == "Voucher belum bisa dicek. Lepas voucher untuk melanjutkan.")
    }
    @Test func labelPotongan() {
        #expect(labelPotonganVoucher(VoucherCheckoutDto(status: "berlaku")) == "Potongan voucher")
        #expect(labelPotonganVoucher(nil) == "Potongan Promo")
    }
    @Test func pesan409VoucherPakaiKalimatGateway() {
        #expect(pesanBayar(.kode(kode: "voucher_tidak_berlaku", pesan: "Kuota voucher sudah habis")) == "Kuota voucher sudah habis")
    }
    @Test func alasanDisembunyikanBilaTerkunciSebabLain() {
        #expect(tampilkanAlasanKunciVoucher(alasan: nil, masalah: []))
        #expect(!tampilkanAlasanKunciVoucher(alasan: "keranjang_berubah", masalah: []))
        #expect(!tampilkanAlasanKunciVoucher(alasan: nil, masalah: [
            CartProblemDto(menuItemId: "m1", name: "Menu", jenis: "harga_berubah", hargaBaru: 12000)]))
    }
}

/// Checkout, pembayaran & halaman Voucher dengan gateway palsu (`GatewayRute`).
@MainActor
@Suite(.serialized)
struct VoucherAlurTests {
    private let validasi = "/api/v1/checkout/validate"

    private func rakit(_ antrean: [String: [(Int, String)]]) -> (Repository, CartStore) {
        GatewayRute.pasang([:], antrean: antrean)
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        let gateway = GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { "t" },
                                    session: URLSession(configuration: konfig))
        let cart = CartStore.diMemori()
        cart.pakaiOutlet("A")
        cart.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: nil)
        return (Repository(gateway: gateway), cart)
    }

    private func json(_ jalur: String) throws -> [String: Any] {
        let body = try #require(GatewayRute.bodyTerakhir[jalur])
        return try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
    }

    @Test func voucherBerlakuDikirimDanMembukaBayar() async throws {
        let (repo, cart) = rakit([validasi: [(200, #"""
        {"ok":true,"subtotal":50000,"discountAmount":5000,"total":45000,
         "voucher":{"id":"v1","nama":"Hemat 10%","status":"berlaku","potongan":5000,
         "item_gratis":[{"menu_item_id":"g","name":"Es Teh","unit_price":0,"quantity":1}]}}
        """#)]])
        cart.pasangVoucher(PilihanVoucher(id: "v1", nama: "Hemat"))
        let vm = CheckoutViewModel(repository: repo, cart: cart)
        await vm.validasi()
        #expect(try json(validasi)["voucher_id"] as? String == "v1")
        #expect(vm.bolehLanjut && vm.total == 45000)
        #expect(vm.blokVoucher?.itemGratis.count == 1)
        #expect(vm.alasanKunciVoucherTampil == nil)
    }

    @Test func voucherBelumMengunciBayarDenganAlasan() async {
        let (repo, cart) = rakit([validasi: [(200,
            #"{"ok":true,"subtotal":50000,"total":50000,"voucher":{"id":"v1","status":"belum","alasan":"Kurang Rp100.000 lagi"}}"#)]])
        cart.pasangVoucher(PilihanVoucher(id: "v1", nama: "Diskon"))
        let vm = CheckoutViewModel(repository: repo, cart: cart)
        await vm.validasi()
        #expect(!vm.bolehLanjut)
        #expect(vm.alasanKunciVoucherTampil == "Kurang Rp100.000 lagi")
    }

    @Test func voucherTanpaBlokDariGatewayMengunci() async {
        let (repo, cart) = rakit([validasi: [(200, #"{"ok":true,"subtotal":50000,"total":50000}"#)]])
        cart.pasangVoucher(PilihanVoucher(kode: "KODE", nama: "KODE"))
        let vm = CheckoutViewModel(repository: repo, cart: cart)
        await vm.validasi()
        #expect(!vm.bolehLanjut)
    }

    @Test func lepasVoucherValidasiUlangTanpaVoucher() async throws {
        let (repo, cart) = rakit([validasi: [
            (200, #"{"ok":true,"subtotal":50000,"total":50000,"voucher":{"id":"v1","status":"belum","alasan":"x"}}"#),
            (200, #"{"ok":true,"subtotal":50000,"total":50000}"#),
        ]])
        cart.pasangVoucher(PilihanVoucher(id: "v1", nama: "Diskon"))
        let vm = CheckoutViewModel(repository: repo, cart: cart)
        await vm.validasi()
        await vm.lepasVoucher()
        #expect(try json(validasi)["voucher_id"] == nil)
        #expect(vm.bolehLanjut && cart.voucher() == nil)
    }

    @Test func pembayaranDenganVoucherTakMenampilkanSubtotalLokal() async throws {
        let (repo, cart) = rakit([
            "/api/v1/orders": [(200, #"{"order_id":"o1","total_amount":45000,"expires_at":"2099-01-01T00:00:00Z","qr_string":"QR"}"#)],
        ])
        cart.pasangVoucher(PilihanVoucher(id: "v1", nama: "Hemat"))
        let suite = "uji-voucher-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        defer { d.removePersistentDomain(forName: suite) }
        let vm = PaymentViewModel(repository: repo, cart: cart, percobaan: OrderAttemptStore(defaults: d),
                                  jadwal: JadwalTanya(jedaAwal: .milliseconds(20), jedaLanjut: .milliseconds(20),
                                                      ambang: .seconds(60), batas: .milliseconds(100)))
        // Subtotal lokal (50.000) pra-voucher, jadi tidak boleh tampil.
        #expect(vm.totalTagihan == 0)
        await vm.bayar()
        #expect(try json("/api/v1/orders")["voucher_id"] as? String == "v1")
        #expect(vm.totalTagihan == 45000)
    }

    @Test func halamanVoucherMemuatLaluPakaiMemasangDiKeranjang() async {
        let cart = CartStore.diMemori()
        let v = try! JSONDecoder().decode(VoucherDto.self, from: Data(
            #"{"id":"v1","nama":"Hemat","jenis":"persen","kalimat_syarat":"Potongan 10%","status":"berlaku"}"#.utf8))
        let vm = VoucherViewModel(muat: { .sukses([v]) }, cart: cart)
        await vm.muatUlang()
        #expect(vm.vouchers == [v])
        vm.pakai(v)
        #expect(cart.voucher() == PilihanVoucher(id: "v1", nama: "Hemat"))
    }

    @Test func halamanVoucherMenampilkanGalat() async {
        let vm = VoucherViewModel(muat: { .gagal(.server(status: 502)) }, cart: CartStore.diMemori())
        await vm.muatUlang()
        guard case .server(502)? = vm.galat else { Issue.record("harus galat server"); return }
    }
}
