import Foundation
import Observation

/// Padanan `KategoriNotifikasi` (NotificationViewModel.kt).
enum KategoriNotifikasi: CaseIterable {
    case semua, pesanan, promo

    var label: String {
        switch self {
        case .semua: "Semua"
        case .pesanan: "Pesanan"
        case .promo: "Promo & Info"
        }
    }

    func saring(_ n: [NotificationDto]) -> [NotificationDto] {
        switch self {
        case .semua: n
        case .pesanan: n.filter { $0.type == "order_status" || $0.type == "reminder" }
        case .promo: n.filter { $0.type == "promo" || $0.type == "system" }
        }
    }
}

/// Padanan `NotificationViewModel.kt`. Menandai dibaca bersifat optimistis:
/// tampilan berubah dulu, gateway menyusul.
@MainActor
@Observable
final class NotificationViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    private(set) var semua: [NotificationDto] = []
    private(set) var unreadCount = 0
    var tab: KategoriNotifikasi = .semua

    var tampil: [NotificationDto] { tab.saring(semua) }

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let store: NotificationStore

    init(repository: Repository, store: NotificationStore) {
        self.repository = repository
        self.store = store
    }

    func muat() async {
        memuat = semua.isEmpty
        galat = nil
        switch await repository.ambilNotifikasi() {
        case .sukses(let d):
            semua = d.notifications
            unreadCount = d.unreadCount
            store.setUnreadCount(d.unreadCount)
        case .gagal(let g):
            galat = g
        }
        memuat = false
    }

    func tandaiDibaca(_ id: String) async {
        guard let i = semua.firstIndex(where: { $0.id == id }), !semua[i].isRead else { return }
        semua[i].isRead = true
        unreadCount = max(unreadCount - 1, 0)
        store.setUnreadCount(unreadCount)
        _ = await repository.tandaiNotifikasiDibaca(notificationId: id)
    }

    func tandaiSemuaDibaca() async {
        guard unreadCount > 0 else { return }
        for i in semua.indices { semua[i].isRead = true }
        unreadCount = 0
        store.setUnreadCount(0)
        _ = await repository.tandaiNotifikasiDibaca(tandaiSemua: true)
    }
}
