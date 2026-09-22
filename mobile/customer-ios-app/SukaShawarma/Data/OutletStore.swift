import Foundation

/// Padanan `data/OutletStore.kt`: outlet yang sedang dipilih pelanggan.
///
/// `UserDefaults` biasa, BUKAN Keychain: ini preferensi tampilan, bukan
/// identitas. Hanya id & nama yang disimpan — status buka/tutup TIDAK, karena
/// status basi akan membuat aplikasi menjanjikan outlet buka padahal tidak.
final class OutletStore: @unchecked Sendable {
    // UserDefaults aman dipakai lintas thread; @unchecked hanya karena
    // UserDefaults belum ditandai Sendable oleh Foundation.
    private let defaults: UserDefaults

    private static let kunciId = "outlet_id"
    private static let kunciNama = "outlet_nama"

    init(defaults: UserDefaults = UserDefaults(suiteName: "suka_customer_outlet") ?? .standard) {
        self.defaults = defaults
    }

    func simpan(id: String, nama: String) {
        defaults.set(id, forKey: Self.kunciId)
        defaults.set(nama, forKey: Self.kunciNama)
    }

    func idTerpilih() -> String? { defaults.string(forKey: Self.kunciId) }

    func namaTerpilih() -> String? { defaults.string(forKey: Self.kunciNama) }

    func hapus() {
        defaults.removeObject(forKey: Self.kunciId)
        defaults.removeObject(forKey: Self.kunciNama)
    }
}
