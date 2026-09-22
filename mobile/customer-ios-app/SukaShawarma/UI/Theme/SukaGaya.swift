import SwiftUI
import UIKit

/// Padanan `ui/theme/Shape.kt` + warna pelengkap yang di Android ditulis
/// langsung di layar (dikumpulkan di sini agar tidak berserakan).
extension Color {
    /// Teks krem di atas latar cokelat (0xFFFFF4EB di Android).
    static let sukaCreamTeks = Color(hex: 0xFFF4EB)
    /// Tepi gelap kartu cokelat (0xFF8A1D07).
    static let sukaBrownTepi = Color(hex: 0x8A1D07)
}

enum SukaGradien {
    /// `SukaBrandHeaderGradient` di HomeHeader.kt.
    static let kepala = LinearGradient(
        colors: [Color(hex: 0x4A0E03), .sukaBrown, Color(hex: 0x5E1203)],
        startPoint: .top, endPoint: .bottom)
}

extension Color {
    /// Warna bilah status = warna teratas gradien kepala, supaya menyatu.
    static let sukaBilahStatus = Color(hex: 0x4A0E03)
}

extension View {
    /// Mewarnai area bilah status (jam, sinyal, baterai) cokelat Suka.
    ///
    /// Kepala Beranda berada di dalam ScrollView sehingga latarnya tak bisa
    /// menjangkau ke belakang bilah status; layar berkepala krem (bayar, status,
    /// sukses, masuk, pilih outlet) juga krem di sana. Ikon status selalu putih
    /// (lihat SukaShawarmaApp), jadi area itu WAJIB cokelat agar terbaca.
    ///
    /// Pasang pada tampilan akar layar.
    func latarBilahStatus() -> some View {
        overlay {
            Color.sukaBilahStatus
                .frame(height: tinggiBilahStatus())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    /// Padanan `Surface(shadowElevation = n)` — bayangan lembut Material.
    func bayangan(_ elevasi: CGFloat) -> some View {
        shadow(color: .black.opacity(0.10), radius: elevasi, x: 0, y: elevasi / 2)
    }

    /// Kartu putih bertepi `SukaBorder` — pola `Surface` paling umum di Android.
    func kartuSuka(sudut: CGFloat = 16, elevasi: CGFloat = 2, latar: Color = .sukaCard,
                   tepi: Color = .sukaBorder) -> some View {
        background(latar, in: RoundedRectangle(cornerRadius: sudut))
            .overlay(RoundedRectangle(cornerRadius: sudut).stroke(tepi, lineWidth: 1))
            .bayangan(elevasi)
    }
}

/// Padanan `Modifier.bounceClick` (MotionModifier.kt): mengecil lalu memantul
/// saat ditekan.
struct MentulStyle: ButtonStyle {
    var skala: CGFloat = 0.96

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .scaleEffect(configuration.isPressed ? skala : 1)
            .animation(.spring(response: 0.35, dampingFraction: 0.55), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == MentulStyle {
    static func mentul(_ skala: CGFloat = 0.96) -> MentulStyle { MentulStyle(skala: skala) }
}

/// Tinggi bilah status sungguhan, dibaca dari jendela aktif. (GeometryReader
/// melaporkan 0 di sini karena tampilan induknya sudah selayar penuh.)
@MainActor
private func tinggiBilahStatus() -> CGFloat {
    let jendela = UIApplication.shared.connectedScenes
        .compactMap { ($0 as? UIWindowScene)?.windows.first { $0.isKeyWindow } ?? ($0 as? UIWindowScene)?.windows.first }
        .first
    return jendela?.safeAreaInsets.top ?? 0
}

/// Semua layar memakai kepala kustom (bilah navigasi sistem disembunyikan).
/// Tanpa ini, menyembunyikan bilah navigasi ikut mematikan gestur geser-kembali
/// iOS — padahal itu cara utama orang kembali di iPhone.
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        viewControllers.count > 1
    }
}
