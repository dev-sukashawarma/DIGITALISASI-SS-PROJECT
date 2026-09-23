import Foundation
import Observation

/// Padanan `data/NotificationStore.kt`: preferensi notifikasi & jumlah belum
/// dibaca (titik di lonceng Beranda). `@Observable` menggantikan `StateFlow`.
///
/// Token FCM Android sengaja tidak diporting — push belum dipakai (§5 butir 4).
@MainActor
@Observable
final class NotificationStore {
    private(set) var unreadCount: Int
    @ObservationIgnored private let defaults: UserDefaults

    private static let kunciPesanan = "notify_order_status"
    private static let kunciPromo = "notify_promotions"
    private static let kunciUnread = "unread_count"

    init(defaults: UserDefaults = UserDefaults(suiteName: "suka_customer_notifications") ?? .standard) {
        self.defaults = defaults
        unreadCount = defaults.integer(forKey: Self.kunciUnread)
    }

    /// (statusPesanan, promo) — keduanya bawaan menyala.
    func bacaPreferensi() -> (statusPesanan: Bool, promo: Bool) {
        (defaults.object(forKey: Self.kunciPesanan) as? Bool ?? true,
         defaults.object(forKey: Self.kunciPromo) as? Bool ?? true)
    }

    func simpanPreferensi(statusPesanan: Bool, promo: Bool) {
        defaults.set(statusPesanan, forKey: Self.kunciPesanan)
        defaults.set(promo, forKey: Self.kunciPromo)
    }

    func setUnreadCount(_ n: Int) {
        unreadCount = max(n, 0)
        defaults.set(unreadCount, forKey: Self.kunciUnread)
    }
}
