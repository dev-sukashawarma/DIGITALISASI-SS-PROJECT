import Foundation
import Testing
@testable import SukaShawarma

/// Porting `StatusPesananTest.kt` (9/9).
struct StatusPesananTests {
    @Test func semuaNilaiConstraintProduksiTerpetakan() {
        for s in ["pending", "preparing", "ready", "completed", "cancelled"] {
            #expect(!tampilanStatus(s).judul.isEmpty, "\(s)")
        }
    }
    @Test func tanpaStatusDapurMenungguPembayaran() {
        let t = tampilanStatus(nil)
        #expect(t.tahap == nil && t.judul.contains("pembayaran"))
    }
    // Porting StatusPesananTest.kt (commit 0991adc7 & cd392b91).
    @Test func draftKadaluarsaBukanMenungguPembayaran() {
        let t = tampilanStatus(nil, statusDraft: "kadaluarsa")
        #expect(t.judul == "Kedaluwarsa" && t.tidakDiproses && t.tahap == nil)
        #expect(!t.dibatalkan) // tak ada uang diambil -> bukan jalur CS refund
    }
    @Test func draftGagalPembayaranGagal() {
        let t = tampilanStatus(nil, statusDraft: "gagal")
        #expect(t.judul == "Pembayaran gagal" && t.tidakDiproses && !t.dibatalkan)
    }
    @Test func draftMenungguBayarTetapMenunggu() {
        let t = tampilanStatus(nil, statusDraft: "menunggu_bayar")
        #expect(t.judul.contains("pembayaran") && !t.tidakDiproses)
    }
    @Test func statusDapurMenangAtasDraft() {
        #expect(tampilanStatus("preparing", statusDraft: "dibayar").tahap == .dibuat)
    }
    @Test func berakhirUntukSelesaiBatalTakDiproses() {
        #expect(tampilanStatus("completed").berakhir)
        #expect(tampilanStatus("cancelled").berakhir)
        #expect(tampilanStatus(nil, statusDraft: "kadaluarsa").berakhir)
        #expect(!tampilanStatus("preparing").berakhir)
        #expect(!tampilanStatus(nil, statusDraft: "menunggu_bayar").berakhir)
    }
    @Test func labelPembayaranHanyaLunasBilaDibayar() {
        #expect(labelPembayaran(statusDapur: nil, statusDraft: "dibayar") == ("QRIS Lunas", true))
        #expect(labelPembayaran(statusDapur: "preparing", statusDraft: "menunggu_bayar").lunas)
        #expect(labelPembayaran(statusDapur: nil, statusDraft: "menunggu_bayar") == ("Belum dibayar", false))
        #expect(labelPembayaran(statusDapur: nil, statusDraft: "kadaluarsa").teks == "Tidak ditagih")
        #expect(labelPembayaran(statusDapur: nil, statusDraft: "gagal").teks == "Tidak ditagih")
    }
    @Test func filterBatalMemuatKedaluwarsa() {
        let p = OrderDetailDto(id: "x", status: "kadaluarsa", totalAmount: 1, createdAt: "2026-09-25T00:00:00Z")
        #expect(FilterRiwayat.batal.saring([p]).count == 1)
        #expect(FilterRiwayat.berjalan.saring([p]).isEmpty)
    }
    /// Padanan uji baru `StatusPesananTest.kt` (19 Okt): cabang "pending" kembar
    /// di Android membuat `pending` terbaca "Menunggu pembayaran".
    @Test func pendingDipetakanKePesananDiterima() {
        let t = tampilanStatus("pending")
        #expect(t.judul == "Pesanan diterima")
        #expect(t.tahap == .diterima)
    }
    @Test func preparingSedangDibuat() { #expect(tampilanStatus("preparing").tahap == .dibuat) }
    @Test func readySiapDiambil() { #expect(tampilanStatus("ready").tahap == .siap) }
    @Test func completedSelesai() {
        let t = tampilanStatus("completed")
        #expect(t.selesai && t.tahap == .siap)
    }
    @Test func cancelledDibatalkan() {
        let t = tampilanStatus("cancelled")
        #expect(t.dibatalkan && t.tahap == nil)
    }
    @Test func statusAsingTetapKalimat() {
        let t = tampilanStatus("status_baru_dari_pos")
        #expect(!t.judul.isEmpty && !t.penjelasan.isEmpty)
    }
    @Test func tahapSebelumnyaIkutTercapai() {
        let tahap = tampilanStatus("preparing").tahap
        #expect(tahapTercapai(tahap, .diterima) && tahapTercapai(tahap, .dibuat) && !tahapTercapai(tahap, .siap))
    }
    @Test func tanpaTahapTakAdaYangTercapai() { #expect(!tahapTercapai(nil, .diterima)) }
}

/// Porting `NotificationFilterTest.kt` (4/4).
struct NotificationFilterTests {
    private let daftar = [
        NotificationDto(id: "1", orderId: "order-123", type: "order_status", title: "Pesanan Diterima",
                        body: "Sedang dimasak di dapur", isRead: false, createdAt: "2026-09-09T10:00:00Z"),
        NotificationDto(id: "2", orderId: "order-123", type: "reminder", title: "Siap Diambil",
                        body: "Pesanan #42 siap diambil", isRead: true, createdAt: "2026-09-09T10:30:00Z"),
        NotificationDto(id: "3", orderId: nil, type: "promo", title: "Diskon Hari Kemerdekaan",
                        body: "Potongan 20% untuk shawarma sapi", isRead: false, createdAt: "2026-09-09T08:00:00Z"),
    ]
    @Test func semua() { #expect(KategoriNotifikasi.semua.saring(daftar).count == 3) }
    @Test func pesanan() {
        let h = KategoriNotifikasi.pesanan.saring(daftar)
        #expect(h.count == 2 && h.allSatisfy { $0.type == "order_status" || $0.type == "reminder" })
    }
    @Test func promo() { #expect(KategoriNotifikasi.promo.saring(daftar).map(\.id) == ["3"]) }
    @Test func hitungBelumDibaca() { #expect(daftar.filter { !$0.isRead }.count == 2) }
}

struct FilterRiwayatTests {
    private func p(_ id: String, _ dapur: String?) -> OrderDetailDto {
        OrderDetailDto(id: id, status: "dibayar", statusDapur: dapur, totalAmount: 1, createdAt: "x")
    }
    @Test func filterMemisahkanKeadaan() {
        let d = [p("a", "preparing"), p("b", "ready"), p("c", "completed"), p("d", "cancelled"), p("e", nil)]
        #expect(FilterRiwayat.semua.saring(d).count == 5)
        #expect(FilterRiwayat.berjalan.saring(d).map(\.id) == ["a", "b"])
        #expect(FilterRiwayat.selesai.saring(d).map(\.id) == ["c"])
        #expect(FilterRiwayat.batal.saring(d).map(\.id) == ["d"])
    }
}

struct FormatWaktuTests {
    @Test func selaluWIBDanBahasaIndonesia() {
        #expect(formatWaktuPendek("2026-09-07T03:23:34.097Z") == "7 Sep 2026, 10.23")
        #expect(formatWaktuPendek("2026-08-17T10:00:00+07:00") == "17 Agu 2026, 10.00")
        #expect(formatWaktuPendek("entah") == nil)
        #expect(formatWaktuPendek(nil) == nil)
    }
}

@MainActor
@Suite(.serialized)
struct Fase5ViewModelTests {
    private func gateway(_ rute: [String: (Int, String)], antrean: [String: [(Int, String)]] = [:]) -> Repository {
        GatewayRute.pasang(rute, antrean: antrean)
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        return Repository(gateway: GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { "t" },
                                                 session: URLSession(configuration: konfig)))
    }
    private func store() -> NotificationStore {
        NotificationStore(defaults: UserDefaults(suiteName: "uji-notif-\(UUID().uuidString)")!)
    }

    @Test func statusBerhentiSendiriSaatSelesai() async {
        let repo = gateway([:], antrean: ["/api/v1/orders/o1": [
            (200, #"{"id":"o1","status":"dibayar","status_dapur":"preparing","total_amount":1,"pos_order_number":7,"created_at":"x"}"#),
            (200, #"{"id":"o1","status":"dibayar","status_dapur":"completed","total_amount":1,"pos_order_number":7,"created_at":"x"}"#),
        ]])
        let vm = OrderStatusViewModel(repository: repo, orderId: "o1", jeda: .milliseconds(10))
        await vm.pantau()  // harus kembali sendiri, bukan berputar selamanya
        let akhir = tampilanStatus(vm.pesanan?.statusDapur)
        #expect(akhir.selesai)
    }

    @Test func galatMempertahankanNomorPesanan() async {
        let repo = gateway([:], antrean: ["/api/v1/orders/o1": [
            (200, #"{"id":"o1","status":"dibayar","status_dapur":"ready","total_amount":1,"pos_order_number":7,"created_at":"x"}"#),
            (502, "x"),
        ]])
        let vm = OrderStatusViewModel(repository: repo, orderId: "o1")
        await vm.ambil()
        await vm.ambil()
        #expect(vm.pesanan?.posOrderNumber == 7 && vm.galat != nil)
    }

    @Test func tandaiDibacaOptimistis() async {
        let repo = gateway(["/api/v1/notifications": (200, #"{"notifications":[{"id":"a","type":"promo","title":"t","body":"b","is_read":false,"created_at":"x"},{"id":"b","type":"promo","title":"t","body":"b","is_read":false,"created_at":"x"}],"unread_count":2}"#)])
        let s = store()
        let vm = NotificationViewModel(repository: repo, store: s)
        await vm.muat()
        #expect(s.unreadCount == 2)
        await vm.tandaiDibaca("a")
        await vm.tandaiDibaca("a")  // kedua kali tak mengurangi lagi
        #expect(vm.unreadCount == 1 && s.unreadCount == 1)
        await vm.tandaiSemuaDibaca()
        #expect(vm.unreadCount == 0 && vm.semua.allSatisfy(\.isRead))
    }

    @Test func riwayatTanpaSesiMelaporkanSesiTidakSah() async {
        let vm = HistoryViewModel(repository: gateway(["/api/v1/orders/list": (401, "{}")]))
        await vm.muat()
        guard case .sesiTidakSah? = vm.galat else { Issue.record("harus sesiTidakSah"); return }
    }

    @Test func preferensiNotifikasiBawaanMenyala() {
        let s = store()
        let awal = s.bacaPreferensi()
        #expect(awal.statusPesanan && awal.promo)
        s.simpanPreferensi(statusPesanan: false, promo: true)
        let baru = s.bacaPreferensi()
        #expect(!baru.statusPesanan && baru.promo)
    }
}
