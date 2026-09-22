import SwiftUI

/// Padanan `ui/theme/Type.kt`. Lilita One = judul & angka; Plus Jakarta Sans
/// = body. Nama font = nama PostScript berkas di `Resources/Fonts`.
///
/// Ukuran memakai `relativeTo:` agar tetap mengikuti Dynamic Type iOS
/// (padanan satuan `sp` di Android).
enum SukaFont {
    static func lilita(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> Font {
        .custom("LilitaOne", size: size, relativeTo: style)
    }

    static func jakarta(_ size: CGFloat, weight: Font.Weight = .regular,
                        relativeTo style: Font.TextStyle = .body) -> Font {
        let nama: String
        switch weight {
        case .bold, .heavy, .black, .semibold: nama = "PlusJakartaSans-Bold"
        case .medium: nama = "PlusJakartaSans-Medium"
        default: nama = "PlusJakartaSans-Regular"
        }
        return .custom(nama, size: size, relativeTo: style)
    }

    // Skala Material3 yang dipakai customer-app.
    static let headlineLarge  = lilita(32, relativeTo: .largeTitle)
    static let headlineMedium = lilita(24, relativeTo: .title)
    static let headlineSmall  = lilita(20, relativeTo: .title2)
    static let titleLarge     = lilita(18, relativeTo: .title3)
    static let titleMedium    = jakarta(16, weight: .bold, relativeTo: .headline)
    static let bodyLarge      = jakarta(16, relativeTo: .body)
    static let bodyMedium     = jakarta(14, relativeTo: .callout)
    static let bodySmall      = jakarta(12, relativeTo: .footnote)
    static let labelLarge     = jakarta(14, weight: .medium, relativeTo: .subheadline)
}
