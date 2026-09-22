import SwiftUI

/// Padanan `ui/theme/Color.kt` — nilai heksa identik. Rasio kontras di
/// komentar Android berlaku sama di sini.
extension Color {
    static let sukaBrown  = Color(hex: 0x701604) // tombol utama, teks putih — 11,6:1
    static let sukaOrange = Color(hex: 0xF29744) // aksen & harga, teks ink  —  7,3:1
    static let sukaInk    = Color(hex: 0x400A07) // teks utama
    static let sukaCream  = Color(hex: 0xFFF7ED) // latar
    static let sukaGreen  = Color(hex: 0x0A7D2C) // sukses, outlet buka
    static let sukaCard   = Color(hex: 0xFFFFFF)
    static let sukaBorder = Color(hex: 0xF1DDC9)
    /// Android: 0x9A7A63 — hanya 3,5–3,9:1 di atas putih/krem (GAGAL WCAG AA).
    /// Digelapkan secukupnya (hue sama) agar ≥ 4,5:1 di semua latar terang.
    static let sukaMuted  = Color(hex: 0x826754)
    static let sukaBody   = Color(hex: 0x6B5548)
    static let sukaTint   = Color(hex: 0xFDF0E2)

    /// Oranye untuk TEKS di atas latar terang. `sukaOrange` sebagai teks di
    /// atas putih hanya 2,3:1; ia tetap dipakai untuk isian, tombol, ikon, dan
    /// teks di atas cokelat (5,1:1).
    static let sukaOrangeTeks = Color(hex: 0xA8560B)
    /// Merah galat/batal untuk teks (Android 0xDC2626 = 4,4:1 di latar merah muda).
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
}
