import Foundation

/// Padanan `navigation/NavRoutes.kt`. Tab (Beranda/Menu/Pesanan/Profil) bukan
/// rute di sini — lihat `TabUtama`. Rute di bawah didorong ke atas tab dan
/// menyembunyikan bilah bawah, sama seperti Android.
enum Rute: Hashable {
    case detail(menuItemId: String)
    case keranjang
    case checkout
    /// `tujuan` = ke mana pelanggan dibawa setelah berhasil masuk. Masuk dari
    /// titik bayar harus kembali ke titik bayar, bukan ke katalog.
    case masuk(tujuan: TujuanMasuk)
    case bayar
    case notifikasi
    case infoAkun
    case sukses(orderId: String, nomor: Int?)
    case status(orderId: String)
}

enum TujuanMasuk: Hashable {
    case katalog
    case checkout
}
