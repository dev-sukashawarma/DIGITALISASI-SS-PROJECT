import Foundation
import Testing
@testable import SukaShawarma

/// Porting `IdempotensiTest.kt` (8/8).
struct IdempotensiTests {
    private let lama = "9197d153-2a29-4ca8-a123-a4a6ff8e1cbf"

    @Test func kadaluarsaWajibIdBaru() {
        #expect(idBerikutnya(lama, galat: .kode(kode: "pesanan_kadaluarsa", pesan: "kedaluwarsa")) != lama)
    }
    @Test func sedangDiprosesWajibIdSama() {
        #expect(idBerikutnya(lama, galat: .kode(kode: "pesanan_sedang_diproses", pesan: "tunggu")) == lama)
    }
    @Test func galatJaringanIdSama() { #expect(idBerikutnya(lama, galat: .jaringan(URLError(.timedOut))) == lama) }
    @Test func galatServerIdSama() { #expect(idBerikutnya(lama, galat: .server(status: 500)) == lama) }
    @Test func sesiTidakSahIdSama() { #expect(idBerikutnya(lama, galat: .sesiTidakSah) == lama) }
    @Test func keranjangBerubahIdSama() {
        #expect(idBerikutnya(lama, galat: .kode(kode: "keranjang_berubah", pesan: "berubah")) == lama)
    }
    @Test func kodeTakDikenalIdSama() { #expect(idBerikutnya(lama, galat: .kode(kode: "kode_baru", pesan: "entah")) == lama) }
    @Test func idBaruSelaluBerbeda() { #expect(idPesananBaru() != idPesananBaru()) }
}

/// Porting `NasibPercobaanTest.kt` (8/8).
struct NasibPercobaanTests {
    /// 2026-09-07T11:00:00Z
    private let sekarang: Int64 = 1_788_778_800_000

    @Test func lewatBatasMulaiBaru() {
        #expect(nasibPercobaan(status: "menunggu_bayar", expiresAt: "2026-09-07T10:23:00.000Z", sekarang: sekarang) == .mulaiBaru)
    }
    @Test func dalamBatasLanjutkan() {
        #expect(nasibPercobaan(status: "menunggu_bayar", expiresAt: "2026-09-07T11:10:00.000Z", sekarang: sekarang) == .lanjutkan)
    }
    @Test func batasTakDiketahuiTakDibuang() {
        #expect(nasibPercobaan(status: "menunggu_bayar", expiresAt: nil, sekarang: sekarang) == .lanjutkan)
    }
    @Test func batasTakTerbacaTakDibuang() {
        #expect(nasibPercobaan(status: "menunggu_bayar", expiresAt: "entah apa ini", sekarang: sekarang) == .lanjutkan)
    }
    @Test func kadaluarsaMulaiBaru() { #expect(nasibPercobaan(status: "kadaluarsa", expiresAt: nil, sekarang: sekarang) == .mulaiBaru) }
    @Test func dibayarDanGagal() {
        #expect(nasibPercobaan(status: "dibayar", expiresAt: nil, sekarang: sekarang) == .dibayar)
        #expect(nasibPercobaan(status: "gagal", expiresAt: nil, sekarang: sekarang) == .gagal)
    }
    @Test func statusAsingMasihHidup() { #expect(nasibPercobaan(status: "status_baru", expiresAt: nil, sekarang: sekarang) == .lanjutkan) }
    @Test func tepatPadaDetikKedaluwarsaMati() {
        #expect(nasibPercobaan(status: "menunggu_bayar", expiresAt: "2026-09-07T11:00:00.000Z", sekarang: sekarang) == .mulaiBaru)
    }
}

struct QrisTests {
    @Test func qrisTergambarPersegi() throws {
        let g = try #require(gambarQris("00020101021226670016COM.CONTOH6304ABCD"))
        #expect(g.size.width == g.size.height && g.size.width >= 300)
    }
}

/// `PaymentViewModel` — tanpa padanan uji di Android, padahal di sinilah
/// tagihan ganda bisa lahir.
@MainActor
@Suite(.serialized)
struct PaymentViewModelTests {
    private let jadwalCepat = JadwalTanya(jedaAwal: .milliseconds(20), jedaLanjut: .milliseconds(20),
                                          ambang: .seconds(60), batas: .milliseconds(400))
    private let order = #"{"order_id":"o1","total_amount":50000,"expires_at":"2099-01-01T00:00:00Z","qr_string":"QR"}"#
    private func status(_ s: String, nomor: String = "null") -> (Int, String) {
        (200, #"{"id":"o1","status":"\#(s)","total_amount":50000,"pos_order_number":\#(nomor),"created_at":"2026-09-07T10:00:00Z","qr_string":"QR"}"#)
    }

    private func rakit(rute: [String: (Int, String)] = [:], antrean: [String: [(Int, String)]]) -> (PaymentViewModel, CartStore, OrderAttemptStore, () -> Void) {
        GatewayRute.pasang(rute, antrean: antrean)
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        let gateway = GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { "t" },
                                    session: URLSession(configuration: konfig))
        let suite = "uji-bayar-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        let percobaan = OrderAttemptStore(defaults: d)
        let cart = CartStore.diMemori()
        cart.pakaiOutlet("A")
        cart.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: nil)
        let vm = PaymentViewModel(repository: Repository(gateway: gateway), cart: cart, percobaan: percobaan, jadwal: jadwalCepat)
        return (vm, cart, percobaan, { d.removePersistentDomain(forName: suite) })
    }

    private func tungguSampai(_ syarat: @escaping () -> Bool) async {
        for _ in 0..<100 where !syarat() { try? await Task.sleep(for: .milliseconds(20)) }
    }

    @Test func idDisimpanSebelumDikirimDanPembayaranTerkonfirmasi() async throws {
        let (vm, cart, percobaan, bersih) = rakit(antrean: [
            "/api/v1/orders": [(200, order)],
            "/api/v1/orders/o1": [status("menunggu_bayar"), status("dibayar", nomor: "42")],
        ]); defer { bersih() }
        await vm.mulai()
        #expect(vm.qrString == "QR" && vm.orderId == "o1")
        let body = try #require(GatewayRute.bodyTerakhir["/api/v1/orders"])
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["client_order_id"] as? String != nil)

        await tungguSampai { vm.dibayar }
        #expect(vm.dibayar && vm.nomorPesanan == 42)
        #expect(cart.isi().isEmpty)
        #expect(percobaan.clientOrderId() == nil && percobaan.orderId() == nil)
    }

    @Test func galatJaringanMempertahankanIdYangSama() async {
        let (vm, _, percobaan, bersih) = rakit(antrean: ["/api/v1/orders": [(502, "bad gateway")]]); defer { bersih() }
        await vm.bayar()
        let pertama = percobaan.clientOrderId()
        #expect(pertama != nil && vm.pesanGalat != nil)
        GatewayRute.pasang([:], antrean: ["/api/v1/orders": [(502, "bad gateway")]])
        await vm.bayar()
        #expect(percobaan.clientOrderId() == pertama)
    }

    @Test func pesananKadaluarsaMenggantiId() async {
        let (vm, _, percobaan, bersih) = rakit(antrean: [
            "/api/v1/orders": [(409, #"{"error":"pesanan_kadaluarsa","pesan":"x"}"#)],
        ]); defer { bersih() }
        percobaan.simpanClientOrderId("lama")
        await vm.bayar()
        #expect(percobaan.clientOrderId() != "lama")
        #expect(vm.pesanGalat?.contains("Batas waktu") == true)
    }

    @Test func percobaanHidupDilanjutkanTanpaPesananKedua() async {
        let (vm, _, percobaan, bersih) = rakit(antrean: [
            "/api/v1/orders/o1": [status("menunggu_bayar"), status("menunggu_bayar")],
        ]); defer { bersih() }
        percobaan.simpanClientOrderId("c1"); percobaan.simpanOrderId("o1")
        await vm.mulai()
        #expect(vm.qrString == "QR" && vm.menungguKonfirmasi)
        #expect(GatewayRute.bodyTerakhir["/api/v1/orders"] == nil)  // tak ada POST pesanan baru
        #expect(percobaan.clientOrderId() == "c1")
    }

    @Test func percobaanMatiMemulaiPesananBaruDenganIdBaru() async {
        let (vm, _, percobaan, bersih) = rakit(antrean: [
            "/api/v1/orders/o1": [(200, #"{"id":"o1","status":"kadaluarsa","total_amount":1,"created_at":"x"}"#)],
            "/api/v1/orders": [(200, order)],
        ]); defer { bersih() }
        percobaan.simpanClientOrderId("c-lama"); percobaan.simpanOrderId("o1")
        await vm.mulai()
        #expect(GatewayRute.bodyTerakhir["/api/v1/orders"] != nil)
        #expect(percobaan.clientOrderId() != "c-lama")
    }

    @Test func galatSaatMemeriksaPercobaanLamaTakMenagihUlang() async {
        let (vm, _, percobaan, bersih) = rakit(antrean: ["/api/v1/orders/o1": [(502, "x")]]); defer { bersih() }
        percobaan.simpanClientOrderId("c1"); percobaan.simpanOrderId("o1")
        await vm.mulai()
        // Nasib tak diketahui → pantau, JANGAN buat pesanan kedua.
        #expect(GatewayRute.bodyTerakhir["/api/v1/orders"] == nil)
        #expect(vm.menungguKonfirmasi && percobaan.clientOrderId() == "c1")
    }

    @Test func waktuHabisBukanGagal() async {
        let (vm, _, _, bersih) = rakit(rute: ["/api/v1/orders/o1": status("menunggu_bayar")],
                                       antrean: ["/api/v1/orders": [(200, order)]]); defer { bersih() }
        await vm.bayar()
        await tungguSampai { vm.waktuHabis }
        #expect(vm.waktuHabis && !vm.gagalBayar && !vm.dibayar)
    }

    @Test func pesanBayarTakMenyuruhTekanLagiSaatDiproses() {
        #expect(pesanBayar(.kode(kode: "pesanan_sedang_diproses", pesan: "x")).contains("jangan tekan bayar lagi"))
        #expect(pesanBayar(.kode(kode: "lain", pesan: "Kalimat gateway")) == "Kalimat gateway")
    }
}
