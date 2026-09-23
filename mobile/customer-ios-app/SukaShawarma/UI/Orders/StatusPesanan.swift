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

    /// Sedang berjalan (bukan menunggu bayar, bukan selesai, bukan batal).
    var berjalan: Bool { tahap != nil && !selesai && !dibatalkan }
}

/// Status dapur → tampilan pelanggan. Nilai sah diverifikasi ke constraint
/// produksi `orders_status_check`: pending, preparing, ready, completed,
/// cancelled. `status_dapur` nil = belum diteruskan ke kasir (belum dibayar).
/// Status asing TIDAK boleh menghasilkan layar kosong.
func tampilanStatus(_ statusDapur: String?) -> TampilanStatus {
    switch statusDapur {
    case nil:
        TampilanStatus(judul: "Menunggu pembayaran",
                       penjelasan: "Pesanan diteruskan ke dapur setelah pembayaran dikonfirmasi.", tahap: nil)
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
        case .berjalan: pesanan.filter { tampilanStatus($0.statusDapur).berjalan }
        case .selesai: pesanan.filter { tampilanStatus($0.statusDapur).selesai }
        case .batal: pesanan.filter { tampilanStatus($0.statusDapur).dibatalkan }
        }
    }
}
