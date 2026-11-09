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
    /// Voucher yang ikut divalidasi, dan jawaban gateway atasnya.
    private(set) var voucher: PilihanVoucher?
    private(set) var blokVoucher: VoucherCheckoutDto?

    /// Boleh lanjut membayar hanya kalau gateway benar-benar meloloskannya —
    /// termasuk voucher: terpasang tapi belum/tidak "berlaku" WAJIB mengunci.
    var bolehLanjut: Bool {
        !memuat && galat == nil && total != nil && masalah.isEmpty && alasan == nil
            && alasanKunciVoucher(voucher, blokVoucher) == nil
    }

    /// Alasan kunci voucher yang boleh ditampilkan (nil bila Bayar terkunci sebab lain).
    var alasanKunciVoucherTampil: String? {
        tampilkanAlasanKunciVoucher(alasan: alasan, masalah: masalah) ? alasanKunciVoucher(voucher, blokVoucher) : nil
    }

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
            voucher = nil
            blokVoucher = nil
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

        let pilihan = cart.voucher()
        let hasil = await repository.validasiCheckout(outletId: outletId, items: isi.flatMap { $0.kePayloadList() },
                                                      voucher: pilihan)
        // Balasan basi dibuang: validasi yang lebih baru sudah jalan, ATAU
        // voucher berubah sejak permintaan ini dikirim (pilih cepat -> lepas).
        guard milikku == generasi, cart.voucher() == pilihan else { return }

        memuat = false
        voucher = pilihan
        switch hasil {
        case .gagal(let g):
            galat = g
            // Jawaban voucher lama bukan milik pilihan ini — jangan tersisa.
            blokVoucher = nil
        case .sukses(let r) where r.ok:
            // Angka gateway yang ditampilkan — menghitung ulang berisiko
            // menampilkan total yang berbeda dari yang benar-benar ditagih.
            subtotal = r.subtotal.map(bulatkanRupiah)
            potongan = r.discountAmount.map(bulatkanRupiah)
            total = r.total.map(bulatkanRupiah)
            blokVoucher = r.voucher
        case .sukses(let r):
            // HTTP 200 + `ok: false` = PENOLAKAN. Total dikosongkan supaya
            // tidak ada jalan menuju pembayaran dari keadaan ini.
            subtotal = nil
            potongan = nil
            total = nil
            masalah = r.masalah ?? []
            alasan = r.alasan
            pesanPenolakan = pesanUntukAlasan(r.alasan, pesanDariGateway: r.pesan)
            blokVoucher = r.voucher
        }
    }

    func pasangVoucher(_ v: PilihanVoucher) async {
        cart.pasangVoucher(v)
        await validasi()
    }

    func lepasVoucher() async {
        cart.lepasVoucher()
        await validasi()
    }

    /// Kelayakan voucher untuk keranjang INI (outlet & isinya).
    func daftarVoucher() async -> GatewayResult<[VoucherDto]> {
        let items = cart.isi().flatMap { $0.kePayloadList() }
        return await repository.vouchers(outletId: cart.outletId(), items: items.isEmpty ? nil : items)
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
