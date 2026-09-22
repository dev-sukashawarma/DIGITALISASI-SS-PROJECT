import Foundation
import Observation

/// Waktu tunggu penanyaan status — DISAMAKAN dengan Android & gateway.
struct JadwalTanya: Sendable {
    /// Jeda selama menit pertama (pembayaran mulus terkonfirmasi dalam detik).
    var jedaAwal: Duration = .seconds(3)
    /// Jeda sesudahnya (pelanggan sedang bergulat dengan aplikasi banknya).
    var jedaLanjut: Duration = .seconds(10)
    var ambang: Duration = .seconds(60)
    /// = umur draft & umur QR di gateway (`BATAS_BAYAR_DETIK`, 15 menit).
    /// Kalau umur draft di gateway diubah, angka ini WAJIB ikut.
    var batas: Duration = .seconds(15 * 60)
}

/// Padanan `PaymentViewModel.kt`.
///
/// Aplikasi TIDAK PERNAH menyimpulkan pembayaran berhasil dari fakta bahwa
/// pelanggan kembali dari aplikasi bank. Kebenarannya ada di webhook Xendit ke
/// gateway; layar ini hanya menunggu gateway mengakuinya.
@MainActor
@Observable
final class PaymentViewModel {
    private(set) var memuat = false
    private(set) var pesanGalat: String?
    /// Teks QRIS yang digambar sendiri — jalur utama.
    private(set) var qrString: String?
    /// URL halaman bayar Xendit — CADANGAN, hanya bila `qrString` kosong.
    /// Mengisinya memicu pembukaan otomatis (sekali).
    private(set) var paymentUrl: String?
    /// URL percobaan yang DILANJUTKAN: hanya menyalakan tombol, tak membuka
    /// otomatis (membuka otomatis melempar pelanggan kembali tepat setelah ia menutupnya).
    private(set) var urlBayarTersimpan: String?
    private(set) var orderId: String?
    private(set) var expiresAt: String?
    private(set) var menungguKonfirmasi = false
    private(set) var dibayar = false
    private(set) var gagalBayar = false
    private(set) var kadaluarsa = false
    private(set) var waktuHabis = false
    private(set) var nomorPesanan: Int?
    private(set) var totalTagihan: Int64

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let cart: CartStore
    @ObservationIgnored private let percobaan: OrderAttemptStore
    @ObservationIgnored private let jadwal: JadwalTanya
    @ObservationIgnored private var tugasTanya: Task<Void, Never>?

    init(repository: Repository, cart: CartStore, percobaan: OrderAttemptStore, jadwal: JadwalTanya = .init()) {
        self.repository = repository
        self.cart = cart
        self.percobaan = percobaan
        self.jadwal = jadwal
        totalTagihan = cart.subtotal()
    }

    /// Titik masuk layar. Percobaan tertinggal DIPERIKSA dulu, tidak langsung
    /// dipantau; galat jaringan saat memeriksa TIDAK memulai pesanan baru.
    func mulai() async {
        guard let id = percobaan.orderId() else {
            await bayar()
            return
        }
        memuat = true
        orderId = id

        switch await repository.statusPesanan(orderId: id) {
        case .gagal:
            // Tidak tahu nasibnya. Arah aman: pantau, jangan menagih ulang.
            memuat = false
            tanyaSampaiPasti(id)
        case .sukses(let d):
            memuat = false
            expiresAt = d.expiresAt
            totalTagihan = bulatkanRupiah(d.totalAmount)
            switch nasibPercobaan(status: d.status, expiresAt: d.expiresAt, sekarang: sekarangMilidetik()) {
            case .dibayar:
                selesaiDibayar(nomor: d.posOrderNumber)
            case .gagal:
                percobaan.selesai()
                gagalBayar = true
            case .mulaiBaru:
                // Id lama sudah terpakai & akan ditolak 409 — buang, buat baru.
                percobaan.selesai()
                orderId = nil
                totalTagihan = cart.subtotal()
                await bayar()
            case .lanjutkan:
                // QR yang SAMA ditampilkan lagi, bukan tagihan kedua. URL dari
                // server didahulukan (salinan lokal hilang saat pasang ulang).
                qrString = d.qrString
                urlBayarTersimpan = d.paymentUrl ?? percobaan.paymentUrl()
                tanyaSampaiPasti(id)
            }
        }
    }

    /// Membuat pesanan (atau mengulang dengan id yang SAMA — idempoten).
    func bayar() async {
        let isi = cart.isi()
        guard !isi.isEmpty, let outletId = cart.outletId() else {
            pesanGalat = "Keranjang sudah kosong."
            return
        }
        let clientOrderId = percobaan.clientOrderId() ?? {
            let baru = idPesananBaru()
            percobaan.simpanClientOrderId(baru)  // SEBELUM permintaan dikirim.
            return baru
        }()

        memuat = true
        pesanGalat = nil
        gagalBayar = false
        kadaluarsa = false
        waktuHabis = false
        totalTagihan = cart.subtotal()

        switch await repository.buatPesanan(clientOrderId: clientOrderId, outletId: outletId,
                                            items: isi.flatMap { $0.kePayloadList() }) {
        case .sukses(let r):
            percobaan.simpanOrderId(r.orderId)
            if let url = r.paymentUrl { percobaan.simpanPaymentUrl(url) }
            memuat = false
            orderId = r.orderId
            expiresAt = r.expiresAt
            totalTagihan = bulatkanRupiah(r.totalAmount)
            // Keduanya bisa nil pada balasan duplikat — bukan galat, lanjut tanya status.
            if let qr = r.qrString { qrString = qr }
            paymentUrl = r.paymentUrl
            tanyaSampaiPasti(r.orderId)
        case .gagal(let g):
            let idBerikut = idBerikutnya(clientOrderId, galat: g)
            if idBerikut != clientOrderId { percobaan.simpanClientOrderId(idBerikut) }
            memuat = false
            pesanGalat = pesanBayar(g)
        }
    }

    /// "Cek Status Pembayaran": tanya SEKARANG, tanpa membuat pesanan lagi dan
    /// tanpa menyalakan putaran penanyaan kedua (lihat RANCANGAN.md §8 Fase 4).
    func cekSekarang() async {
        guard let id = orderId else {
            await bayar()
            return
        }
        if case .sukses(let d) = await repository.statusPesanan(orderId: id) { terapkanStatus(d) }
    }

    /// Menanyakan status sampai gateway memastikannya (satu putaran saja).
    func tanyaSampaiPasti(_ id: String) {
        tugasTanya?.cancel()
        menungguKonfirmasi = true
        waktuHabis = false
        let jadwal = self.jadwal
        tugasTanya = Task { [weak self] in
            let jam = ContinuousClock()
            let mulai = jam.now
            while jam.now - mulai < jadwal.batas {
                guard let self, !Task.isCancelled else { return }
                // Galat saat menanya BUKAN alasan berhenti: sinyal bisa putus
                // sebentar sementara pembayarannya sudah masuk.
                if case .sukses(let d) = await self.repository.statusPesanan(orderId: id),
                   self.terapkanStatus(d) { return }
                let terlewat = jam.now - mulai
                try? await Task.sleep(for: terlewat < jadwal.ambang ? jadwal.jedaAwal : jadwal.jedaLanjut)
            }
            // Habis waktu BUKAN gagal: pesanan bisa tetap masuk lewat webhook.
            // Pelanggan diarahkan memeriksa riwayat, bukan membayar lagi.
            guard let self, !Task.isCancelled else { return }
            self.menungguKonfirmasi = false
            self.waktuHabis = true
        }
    }

    /// Mengembalikan true bila status sudah pasti (penanyaan boleh berhenti).
    @discardableResult
    private func terapkanStatus(_ d: OrderDetailDto) -> Bool {
        switch d.status {
        case "dibayar":
            selesaiDibayar(nomor: d.posOrderNumber)
            return true
        case "gagal":
            tugasTanya?.cancel()
            menungguKonfirmasi = false
            gagalBayar = true
            return true
        case "kadaluarsa":
            // Draft hangus: percobaan berikutnya WAJIB memakai id baru.
            tugasTanya?.cancel()
            percobaan.simpanClientOrderId(idPesananBaru())
            menungguKonfirmasi = false
            kadaluarsa = true
            qrString = nil
            return true
        default:
            return false
        }
    }

    private func selesaiDibayar(nomor: Int?) {
        tugasTanya?.cancel()
        cart.kosongkan()
        percobaan.selesai()
        menungguKonfirmasi = false
        nomorPesanan = nomor
        dibayar = true
    }

    /// Menandai bahwa URL otomatis sudah dibuka, agar tak dibuka berulang.
    func urlOtomatisDibuka() {
        if let url = paymentUrl { urlBayarTersimpan = url }
        paymentUrl = nil
    }
}
