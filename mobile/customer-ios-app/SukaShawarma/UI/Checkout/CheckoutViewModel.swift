import Foundation
import Observation

/// Padanan `CheckoutViewModel.kt`. Dibuat BARU setiap kali layar checkout
/// dibuka: harga & ketersediaan bisa berubah di antara dua kunjungan, dan
/// validasi basi di titik bayar justru paling berbahaya.
@MainActor
@Observable
final class CheckoutViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    private(set) var baris: [CartLine] = []
    /// Semua nilai uang di bawah berasal dari GATEWAY, bukan hitungan sendiri.
    private(set) var subtotal: Int64?
    private(set) var potongan: Int64?
    private(set) var total: Int64?
    private(set) var masalah: [CartProblemDto] = []
    private(set) var alasan: String?
    private(set) var pesanPenolakan: String?
    private(set) var keranjangKosong = false

    /// Boleh lanjut membayar hanya kalau gateway benar-benar meloloskannya.
    var bolehLanjut: Bool { !memuat && galat == nil && total != nil && masalah.isEmpty && alasan == nil }

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let cart: CartStore
    /// Menandai validasi terbaru: hasil validasi lama yang datang terlambat
    /// (mis. pelanggan menekan dua perbaikan beruntun) dibuang, bukan menimpa.
    @ObservationIgnored private var generasi = 0

    init(repository: Repository, cart: CartStore) {
        self.repository = repository
        self.cart = cart
    }

    func validasi() async {
        let isi = cart.isi()
        guard !isi.isEmpty, let outletId = cart.outletId() else {
            // Setara `CheckoutState(memuat=false, keranjangKosong=true)` di Android:
            // SEMUA dikosongkan, termasuk total lama — tak boleh tersisa jalan ke bayar.
            generasi += 1
            memuat = false
            keranjangKosong = true
            galat = nil
            baris = []
            subtotal = nil
            potongan = nil
            total = nil
            masalah = []
            alasan = nil
            pesanPenolakan = nil
            return
        }

        generasi += 1
        let milikku = generasi
        keranjangKosong = false
        memuat = true
        galat = nil
        baris = isi
        masalah = []
        alasan = nil
        pesanPenolakan = nil

        let hasil = await repository.validasiCheckout(outletId: outletId, items: isi.flatMap { $0.kePayloadList() })
        guard milikku == generasi else { return }

        memuat = false
        switch hasil {
        case .gagal(let g):
            galat = g
        case .sukses(let r) where r.ok:
            // Angka gateway yang ditampilkan — menghitung ulang berisiko
            // menampilkan total yang berbeda dari yang benar-benar ditagih.
            subtotal = r.subtotal.map(bulatkanRupiah)
            potongan = r.discountAmount.map(bulatkanRupiah)
            total = r.total.map(bulatkanRupiah)
        case .sukses(let r):
            // HTTP 200 + `ok: false` = PENOLAKAN. Total dikosongkan supaya
            // tidak ada jalan menuju pembayaran dari keadaan ini.
            subtotal = nil
            potongan = nil
            total = nil
            masalah = r.masalah ?? []
            alasan = r.alasan
            pesanPenolakan = pesanUntukAlasan(r.alasan, pesanDariGateway: r.pesan)
        }
    }

    /// Memulihkan SATU masalah lalu memvalidasi ulang. Keranjang tidak pernah
    /// dibuang seluruhnya — hanya item bermasalah yang disentuh.
    func perbaiki(_ m: CartProblemDto) async {
        terapkan(m)
        await validasi()
    }

    func perbaikiSemua() async {
        masalah.forEach(terapkan)
        await validasi()
    }

    private func terapkan(_ m: CartProblemDto) {
        if m.jenis == "harga_berubah", let harga = m.hargaBaru {
            cart.perbaruiHarga(menuItemId: m.menuItemId, hargaBaru: bulatkanRupiah(harga))
        } else {
            cart.hapusMenuItem(m.menuItemId)
        }
    }
}
