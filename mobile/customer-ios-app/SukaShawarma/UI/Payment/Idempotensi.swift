import Foundation

/// Padanan `ui/payment/Idempotensi.kt` — bagian paling mudah salah di seluruh
/// aplikasi, dan salahnya mahal ke DUA arah:
///
/// - **Memakai ulang id setelah draftnya kedaluwarsa** mengunci pelanggan:
///   `client_order_id` berkendala UNIQUE, gateway membalas 409 selamanya.
/// - **Membuat id baru saat percobaan sebelumnya masih diproses** menghasilkan
///   DUA tagihan untuk satu keranjang. Pelanggan tertagih dua kali.
///
/// Karena itu id hanya diganti pada SATU kondisi spesifik; setiap kondisi lain
/// — termasuk galat jaringan, yang paling sering — mempertahankan id yang sama.
func idBerikutnya(_ idSekarang: String, galat: GatewayError) -> String {
    if case .kode("pesanan_kadaluarsa", _) = galat { return idPesananBaru() }
    return idSekarang
}

func idPesananBaru() -> String { UUID().uuidString.lowercased() }

/// Nasib satu percobaan pemesanan yang tertinggal.
enum NasibPercobaan: Equatable {
    /// Masih hidup: pantau statusnya, JANGAN buat pesanan kedua.
    case lanjutkan
    case dibayar
    case gagal
    /// Mati (batas waktu lewat / draft hangus): mulai pesanan baru.
    case mulaiBaru
}

/// Dua kehati-hatian yang tidak boleh dilonggarkan:
/// 1. `expires_at` yang TIDAK DIKETAHUI bukan alasan membuang percobaan —
///    membuangnya atas dasar tebakan berarti tagihan kedua.
/// 2. Status tak dikenal diperlakukan sebagai MASIH HIDUP (arah aman = menunggu).
func nasibPercobaan(status: String, expiresAt: String?, sekarang: Int64,
                    uraiWaktu: (String) -> Int64? = uraiWaktuIso) -> NasibPercobaan {
    switch status {
    case "dibayar": return .dibayar
    case "gagal": return .gagal
    case "kadaluarsa": return .mulaiBaru
    case "menunggu_bayar":
        if let batas = expiresAt.flatMap(uraiWaktu), batas <= sekarang { return .mulaiBaru }
        return .lanjutkan
    default: return .lanjutkan
    }
}

/// Kalimat galat saat membuat pesanan. `pesanan_sedang_diproses` sengaja TIDAK
/// menyuruh mencoba lagi segera — menekan bayar berkali-kali di titik ini
/// persis perilaku yang menghasilkan tagihan ganda.
func pesanBayar(_ galat: GatewayError) -> String {
    switch galat {
    case .kode("pesanan_sedang_diproses", _):
        "Pesananmu sedang diproses. Tunggu sebentar, jangan tekan bayar lagi."
    case .kode("pesanan_kadaluarsa", _):
        "Batas waktu pembayaran sudah lewat. Tekan bayar lagi untuk memulai ulang."
    case .kode("keranjang_berubah", _):
        "Menu outlet berubah sejak kamu memilih. Kembali ke ringkasan untuk memperbaikinya."
    default:
        pesanGalat(galat)
    }
}
