import Foundation

/// Padanan `ui/orders/StatusPesanan.kt`. Tiga tahap yang dilihat pelanggan.
enum TahapPesanan: Int, Comparable, CaseIterable {
    case diterima, dibuat, siap
    static func < (a: Self, b: Self) -> Bool { a.rawValue < b.rawValue }
}

struct TampilanStatus: Equatable {
    let judul: String
    let penjelasan: String
    /// Tahap terakhir yang tercapai; nil = pesanan tidak berjalan.
    let tahap: TahapPesanan?
    var selesai = false
    var dibatalkan = false
    /// Pesanan tak pernah sampai ke dapur (batas bayar habis / pembayaran gagal).
    /// Beda dengan `dibatalkan`: tak ada uang diambil, jadi tak ada
    /// pengembalian dana yang perlu diurus (tanpa tombol CS refund).
    var tidakDiproses = false

    /// Tidak akan berubah lagi — berhenti memantau statusnya.
    var berakhir: Bool { selesai || dibatalkan || tidakDiproses }
    /// Sedang berjalan (bukan menunggu bayar, bukan sudah berakhir).
    var berjalan: Bool { tahap != nil && !berakhir }
}

/// Status dapur → tampilan pelanggan. Nilai sah diverifikasi ke constraint
/// produksi `orders_status_check`: pending, preparing, ready, completed,
/// cancelled.
///
/// `status_dapur` nil = belum diteruskan ke kasir: pembayaran belum
/// dikonfirmasi, ATAU pesanan tak pernah dibayar. Pembedanya `statusDraft`
/// (`retail.order_drafts`: menunggu_bayar, dibayar, kadaluarsa, gagal) — tanpa
/// itu pesanan yang batas bayarnya habis tampil "Menunggu pembayaran" selamanya.
/// Status asing TIDAK boleh menghasilkan layar kosong.
func tampilanStatus(_ statusDapur: String?, statusDraft: String? = nil) -> TampilanStatus {
    switch statusDapur {
    case nil:
        switch statusDraft {
        case "kadaluarsa":
            TampilanStatus(judul: "Kedaluwarsa",
                           penjelasan: "Batas waktu pembayaran habis. Pesanan tidak diproses dan kamu tidak ditagih.",
                           tahap: nil, tidakDiproses: true)
        case "gagal":
            TampilanStatus(judul: "Pembayaran gagal",
                           penjelasan: "Pembayaran tidak berhasil. Pesanan tidak diproses dan kamu tidak ditagih.",
                           tahap: nil, tidakDiproses: true)
        default:
            TampilanStatus(judul: "Menunggu pembayaran",
                           penjelasan: "Pesanan diteruskan ke dapur setelah pembayaran dikonfirmasi.", tahap: nil)
        }
    case "pending":
        TampilanStatus(judul: "Pesanan diterima", penjelasan: "Pesananmu sudah masuk ke kasir.", tahap: .diterima)
    case "preparing":
        TampilanStatus(judul: "Sedang dibuat", penjelasan: "Dapur sedang menyiapkan pesananmu.", tahap: .dibuat)
    case "ready":
        TampilanStatus(judul: "Siap diambil", penjelasan: "Sebutkan nomor pesananmu di kasir.", tahap: .siap)
    case "completed":
        TampilanStatus(judul: "Sudah diambil", penjelasan: "Pesanan ini sudah selesai. Terima kasih!",
                       tahap: .siap, selesai: true)
    case "cancelled":
        TampilanStatus(judul: "Dibatalkan",
                       penjelasan: "Pesanan ini dibatalkan. Hubungi outlet kalau kamu merasa ini keliru.",
                       tahap: nil, dibatalkan: true)
    default:
        TampilanStatus(judul: "Sedang diproses", penjelasan: "Pesananmu sedang ditangani outlet.", tahap: .diterima)
    }
}

/// Tahap sebelumnya ikut tercapai: pesanan aplikasi masuk langsung sebagai
/// `preparing`, dan garis waktu tak boleh tampak melompati "Diterima".
func tahapTercapai(_ sekarang: TahapPesanan?, _ tahap: TahapPesanan) -> Bool {
    guard let sekarang else { return false }
    return tahap <= sekarang
}

/// Label di bawah "Total Pembayaran". Pesanan yang sudah punya status dapur
/// pasti sudah dibayar (baru terdorong ke kasir setelah pembayaran dikonfirmasi).
func labelPembayaran(statusDapur: String?, statusDraft: String?) -> (teks: String, lunas: Bool) {
    if statusDapur != nil || statusDraft == "dibayar" { return ("QRIS Lunas", true) }
    if statusDraft == "kadaluarsa" || statusDraft == "gagal" { return ("Tidak ditagih", false) }
    return ("Belum dibayar", false)
}

extension OrderDetailDto {
    /// Tampilan pelanggan dari status dapur + status draft pembayaran.
    var tampilan: TampilanStatus { tampilanStatus(statusDapur, statusDraft: status) }
}

/// Chip filter di layar Riwayat.
enum FilterRiwayat: CaseIterable {
    case semua, berjalan, selesai, batal

    var label: String {
        switch self {
        case .semua: "Semua"
        case .berjalan: "Sedang Berjalan"
        case .selesai: "Selesai"
        case .batal: "Dibatalkan"
        }
    }

    func saring(_ pesanan: [OrderDetailDto]) -> [OrderDetailDto] {
        switch self {
        case .semua: pesanan
        case .berjalan: pesanan.filter { $0.tampilan.berjalan }
        case .selesai: pesanan.filter { $0.tampilan.selesai }
        case .batal: pesanan.filter { $0.tampilan.dibatalkan || $0.tampilan.tidakDiproses }
        }
    }
}
