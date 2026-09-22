import Foundation

/// Padanan `BannerDilihatStore.kt`: id popup yang sudah pernah dilihat di HP
/// ini. Per-HP dengan sengaja — ganti HP berarti melihat popup lagi, wajar.
final class BannerDilihatStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private static let kunci = "popup_dilihat"

    init(defaults: UserDefaults = UserDefaults(suiteName: "banner_dilihat") ?? .standard) {
        self.defaults = defaults
    }

    func sudahDilihat() -> Set<String> {
        Set(defaults.stringArray(forKey: Self.kunci) ?? [])
    }

    func tandai(_ id: String) {
        var baru = sudahDilihat()
        baru.insert(id)
        defaults.set(Array(baru).sorted(), forKey: Self.kunci)
    }
}
