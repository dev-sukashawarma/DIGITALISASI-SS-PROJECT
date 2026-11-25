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
    @ObservationIgnored private var sudahMulai = false

    init(repository: Repository, cart: CartStore, percobaan: OrderAttemptStore, jadwal: JadwalTanya = .init()) {
        self.repository = repository
        self.cart = cart
        self.percobaan = percobaan
        self.jadwal = jadwal
        totalTagihan = cart.voucher() != nil ? 0 : cart.subtotal()
    }

    /// Angka pra-server yang aman ditampilkan sebelum gateway membalas.
    /// `cart.subtotal()` tak tahu soal voucher — dengan voucher ia SELALU
    /// terlalu besar, jadi disembunyikan (0 = blok total tak dirender) sampai
    /// angka gateway datang. QRIS dan layar ini wajib menagih angka yang sama.
    private func totalAwal() -> Int64 { cart.voucher() != nil ? 0 : cart.subtotal() }

    /// Titik masuk layar. Percobaan tertinggal DIPERIKSA dulu, tidak langsung
    /// dipantau; galat jaringan saat memeriksa TIDAK memulai pesanan baru.
    func mulai() async {
        guard !sudahMulai else { return }
        sudahMulai = true
        guard let id = percobaan.orderId() else {
            await bayar()
            return
        }
        // Keranjang/voucher/outlet berubah sejak QRIS lama dibuat -> batalkan draft lama & buat baru.
        let sidikSekarang = cart.sidikJari()
        if let sidikLama = percobaan.sidikJari(), sidikLama != sidikSekarang {
            let repo = self.repository
            Task { _ = await repo.batalkanPesanan(orderId: id) }
            percobaan.selesai()
            await bayar()
            return
        }
        memuat = true
        orderId = id
        // Pesanan ini SUDAH ada di server (dilanjutkan, bukan dibuat): angka
        // lokal (bisa pra-voucher) tidak boleh sempat terlihat. Diisi lagi dari
        // balasan status pertama yang berhasil.
        totalTagihan = 0

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
                totalTagihan = totalAwal()
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
        guard !memuat else { return }
        let isi = cart.isi()
        guard !isi.isEmpty, let outletId = cart.outletId() else {
            pesanGalat = "Keranjang sudah kosong."
            return
        }
        let sidikSekarang = cart.sidikJari()
        let clientOrderId = percobaan.clientOrderId() ?? {
            let baru = idPesananBaru()
            percobaan.simpanClientOrderId(baru)  // SEBELUM permintaan dikirim.
            return baru
        }()
        percobaan.simpanSidikJari(sidikSekarang)

        memuat = true
        pesanGalat = nil
        gagalBayar = false
        kadaluarsa = false
        waktuHabis = false
        totalTagihan = totalAwal()

        switch await repository.buatPesanan(clientOrderId: clientOrderId, outletId: outletId,
                                            items: isi.flatMap { $0.kePayloadList() },
                                            voucher: cart.voucher()) {
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
            if idBerikut != clientOrderId {
                percobaan.selesai()
                percobaan.simpanClientOrderId(idBerikut)
                percobaan.simpanSidikJari(sidikSekarang)
            }
            memuat = false
            pesanGalat = pesanBayar(g)
        }
    }

    /// "Cek Status Pembayaran" (padanan `periksaStatusSekarang`): tanya SEKARANG,
    /// tanpa membuat pesanan lagi dan tanpa menyalakan putaran penanyaan kedua
    /// (lihat RANCANGAN.md §8 Fase 4). Id dari penyimpanan dipakai bila layar
    /// belum sempat mengisinya — percobaan yang tersimpan tak boleh ditagih ulang.
    func cekSekarang() async {
        guard let id = orderId ?? percobaan.orderId() else {
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
                switch await self.repository.statusPesanan(orderId: id) {
                case .sukses(let d):
                    if self.terapkanStatus(d) { return }
                case .gagal(.sesiTidakSah):
                    self.menungguKonfirmasi = false
                    self.pesanGalat = pesanBayar(.sesiTidakSah)
                    return
                case .gagal:
                    break
                }
                let terlewat = jam.now - mulai
                try? await Task.sleep(for: terlewat < jadwal.ambang ? jadwal.jedaAwal : jadwal.jedaLanjut)
            }
            // Habis waktu BUKAN gagal: pesanan bisa tetap masuk lewat webhook.
            // Pelanggan diarahkan memeriksa riwayat, bukan membayar lagi.
            guard let self, !Task.isCancelled else { return }
            self.menungguKonfirmasi = false
            self.waktuHabis = true
            // QR basi tak boleh tetap tampil (dan menahan layar di mode menunggu).
            self.buangTagihan()
        }
    }

    /// Mengembalikan true bila status sudah pasti (penanyaan boleh berhenti).
    @discardableResult
    private func terapkanStatus(_ d: OrderDetailDto) -> Bool {
        totalTagihan = bulatkanRupiah(d.totalAmount)
        if let exp = d.expiresAt { expiresAt = exp }
        if qrString == nil, let qr = d.qrString { qrString = qr }
        if urlBayarTersimpan == nil, let url = d.paymentUrl { urlBayarTersimpan = url }
        switch nasibPercobaan(status: d.status, expiresAt: d.expiresAt, sekarang: sekarangMilidetik()) {
        case .dibayar:
            selesaiDibayar(nomor: d.posOrderNumber)
            return true
        case .gagal:
            tugasTanya?.cancel()
            percobaan.selesai()
            menungguKonfirmasi = false
            gagalBayar = true
            buangTagihan()
            return true
        case .mulaiBaru:
            tugasTanya?.cancel()
            percobaan.selesai()
            menungguKonfirmasi = false
            kadaluarsa = true
            buangTagihan()
            return true
        case .lanjutkan:
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

    /// QR & URL bayar yang sudah tak berlaku. Dibiarkan, `qrString != nil`
    /// menahan layar di mode menunggu meski keadaannya sudah akhir.
    private func buangTagihan() {
        qrString = nil
        paymentUrl = nil
        urlBayarTersimpan = nil
    }

    /// "Batalkan Pembayaran": hentikan penanyaan, lupakan percobaan, lalu minta
    /// gateway membatalkan draftnya. Gateway HANYA membatalkan draft yang masih
    /// `menunggu_bayar` — pesanan yang ternyata sudah lunas tetap aman.
    /// Galat pembatalan diabaikan: draft yang tak terbatalkan hangus sendiri
    /// saat batas bayarnya lewat. Task dikembalikan hanya untuk uji.
    @discardableResult
    func batalkanPercobaan() -> Task<Void, Never>? {
        tugasTanya?.cancel()
        tugasTanya = nil
        let id = orderId ?? percobaan.orderId()
        percobaan.selesai()
        memuat = false
        pesanGalat = nil
        buangTagihan()
        orderId = nil
        expiresAt = nil
        menungguKonfirmasi = false
        dibayar = false
        gagalBayar = false
        kadaluarsa = false
        waktuHabis = false
        nomorPesanan = nil
        totalTagihan = 0
        guard let id else { return nil }
        let repository = self.repository
        return Task { _ = await repository.batalkanPesanan(orderId: id) }
    }

    /// Menandai bahwa URL otomatis sudah dibuka, agar tak dibuka berulang.
    func urlOtomatisDibuka() {
        if let url = paymentUrl { urlBayarTersimpan = url }
        paymentUrl = nil
    }
}
