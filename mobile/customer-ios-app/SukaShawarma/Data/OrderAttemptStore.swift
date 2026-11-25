import Foundation

/// Padanan `data/OrderAttemptStore.kt`: percobaan pemesanan yang sedang berjalan.
///
/// **Harus bertahan lintas peluncuran.** Pembayaran membawa pelanggan keluar
/// aplikasi (ke aplikasi bank/e-wallet) dan iOS boleh mematikan aplikasi selama
/// itu. Kalau `client_order_id` hanya hidup di memori, percobaan berikutnya
/// memakai id baru → **tagihan kedua**. Karena itu id disimpan SEBELUM
/// permintaan pertama dikirim, bukan setelah balasannya datang.
final class OrderAttemptStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private static let kunciClientOrderId = "client_order_id"
    private static let kunciOrderId = "order_id"
    private static let kunciPaymentUrl = "payment_url"
    private static let kunciFingerprint = "cart_fingerprint"

    init(defaults: UserDefaults = UserDefaults(suiteName: "suka_customer_order_attempt") ?? .standard) {
        self.defaults = defaults
    }

    func clientOrderId() -> String? { defaults.string(forKey: Self.kunciClientOrderId) }
    func orderId() -> String? { defaults.string(forKey: Self.kunciOrderId) }
    /// URL halaman bayar, agar pelanggan bisa MEMBUKANYA LAGI setelah kembali.
    func paymentUrl() -> String? { defaults.string(forKey: Self.kunciPaymentUrl) }
    func sidikJari() -> String? { defaults.string(forKey: Self.kunciFingerprint) }

    func simpanClientOrderId(_ id: String) { defaults.set(id, forKey: Self.kunciClientOrderId) }
    func simpanOrderId(_ id: String) { defaults.set(id, forKey: Self.kunciOrderId) }
    func simpanPaymentUrl(_ url: String) { defaults.set(url, forKey: Self.kunciPaymentUrl) }
    func simpanSidikJari(_ fp: String) { defaults.set(fp, forKey: Self.kunciFingerprint) }

    /// Dipanggil HANYA setelah pesanan benar-benar selesai — bukan saat galat,
    /// karena galat justru keadaan di mana id lama harus dipertahankan.
    func selesai() {
        for k in [Self.kunciClientOrderId, Self.kunciOrderId, Self.kunciPaymentUrl, Self.kunciFingerprint] {
            defaults.removeObject(forKey: k)
        }
    }
}
