import SwiftUI

/// Padanan `ui/theme/Color.kt` — nilai heksa selaras dengan identitas brand Suka Shawarma,
/// dihaluskan agar tampilan iOS terlihat lebih elegan, bersih, dan berkelas.
extension Color {
    static let sukaBrown  = Color(hex: 0x701604) // tombol utama, teks putih — 11,6:1
    static let sukaBrownDark = Color(hex: 0x4A0E03) // cokelat panggang pekat untuk gradasi
    static let sukaOrange = Color(hex: 0xF29744) // aksen & harga, teks ink  —  7,3:1
    static let sukaOrangeDark = Color(hex: 0xEA580C) // aksen kontras & CTA
    static let sukaInk    = Color(hex: 0x1A1412) // teks utama arang espresso
    static let sukaCream  = Color(hex: 0xFAF8F5) // latar bersih warm porcelain
    static let sukaCanvas = Color(hex: 0xFAF8F5) // alias latar kanvas utama
    static let sukaGreen  = Color(hex: 0x0A7D2C) // sukses, outlet buka
    static let sukaGreenSoft = Color(hex: 0xE8F5E9) // chip hijau lembut
    static let sukaCard   = Color(hex: 0xFFFFFF)
    static let sukaBorder = Color(hex: 0xEDE4DB) // garis batas halus
    static let sukaBorderSubtle = Color.black.opacity(0.06) // garis rambut ultra-halus
    static let sukaMuted  = Color(hex: 0x75675F) // teks sekunder seimbang
    static let sukaBody   = Color(hex: 0x544740)
    static let sukaTint   = Color(hex: 0xFDF4EC) // sentuhan oranye lembut
    static let sukaAmberSoft = Color(hex: 0xFFF8E1)
    static let sukaRedSoft   = Color(hex: 0xFEF2F2)

    /// Oranye untuk TEKS di atas latar terang.
    static let sukaOrangeTeks = Color(hex: 0xBA5D0D)
    /// Merah galat/batal untuk teks.
    static let sukaMerah = Color(hex: 0xD32222)

    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }

    init(hex: String) {
        let scanner = Scanner(string: hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted))
        var hexNumber: UInt64 = 0
        if scanner.scanHexInt64(&hexNumber) {
            let r = Double((hexNumber & 0xff0000) >> 16) / 255
            let g = Double((hexNumber & 0x00ff00) >> 8) / 255
            let b = Double(hexNumber & 0x0000ff) / 255
            self.init(.sRGB, red: r, green: g, blue: b, opacity: 1.0)
            return
        }
        self.init(.sRGB, red: 0, green: 0, blue: 0, opacity: 1.0)
    }
}
