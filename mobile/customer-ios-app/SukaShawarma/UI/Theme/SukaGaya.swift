import SwiftUI
import UIKit

/// Padanan `ui/theme/Shape.kt` + warna pelengkap dan efek kartu modern yang elegan.
extension Color {
    /// Teks krem di atas latar cokelat (0xFFFFF4EB di Android).
    static let sukaCreamTeks = Color(hex: 0xFFF7F0)
    /// Tepi gelap kartu cokelat (0xFF8A1D07).
    static let sukaBrownTepi = Color(hex: 0x8A1D07)
}

enum SukaGradien {
    /// Gradien kepala modern yang mengalir hangat dan mewah.
    static let kepala = LinearGradient(
        colors: [Color(hex: 0x480C03), Color.sukaBrown, Color(hex: 0x5A1204)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// Gradien oranye untuk tombol aksi primer dan highlight.
    static let oranyePrimer = LinearGradient(
        colors: [Color.sukaOrange, Color(hex: 0xEA580C)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// Gradien peach hangat halus untuk latar atas.
    static let peachHalus = LinearGradient(
        colors: [Color(hex: 0xFCEFE4), Color(hex: 0xFAF8F5)],
        startPoint: .top,
        endPoint: .bottom
    )
}

extension Color {
    /// Warna bilah status = warna teratas gradien kepala, supaya menyatu.
    static let sukaBilahStatus = Color(hex: 0x480C03)
}

extension View {
    /// Mewarnai area bilah status (jam, sinyal, baterai) gradien cokelat Suka.
    func latarBilahStatus() -> some View {
        overlay {
            SukaGradien.kepala
                .frame(height: tinggiBilahStatus())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    /// Bayangan lembut berlapis gaya Apple iOS.
    func bayangan(_ elevasi: CGFloat) -> some View {
        shadow(color: .black.opacity(0.04), radius: elevasi * 1.5, x: 0, y: elevasi * 0.75)
    }

    /// Kartu putih bertepi halus — bersih, simpel, tidak bertumpuk.
    func kartuSuka(sudut: CGFloat = 18, elevasi: CGFloat = 2, latar: Color = .sukaCard,
                    tepi: Color = .sukaBorder.opacity(0.75)) -> some View {
        background(latar, in: RoundedRectangle(cornerRadius: sudut))
            .overlay(RoundedRectangle(cornerRadius: sudut).stroke(tepi, lineWidth: 0.8))
            .shadow(color: .black.opacity(0.035), radius: elevasi * 2, x: 0, y: elevasi)
    }

    /// Kartu berkelas premium dengan bayangan bertingkat dan garis rambut ultra-halus.
    func kartuElegan(sudut: CGFloat = 20, elevasi: CGFloat = 3, latar: Color = .white) -> some View {
        background(latar, in: RoundedRectangle(cornerRadius: sudut))
            .overlay(
                RoundedRectangle(cornerRadius: sudut)
                    .stroke(Color.black.opacity(0.05), lineWidth: 0.7)
            )
            .shadow(color: Color.black.opacity(0.03), radius: elevasi * 2, x: 0, y: elevasi)
            .shadow(color: Color.black.opacity(0.02), radius: elevasi * 0.5, x: 0, y: 1)
    }
}

/// Animasi pegas taktil saat ditekan (tactile spring physics).
struct MentulStyle: ButtonStyle {
    var skala: CGFloat = 0.96

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .scaleEffect(configuration.isPressed ? skala : 1.0)
            .opacity(configuration.isPressed ? 0.94 : 1.0)
            .animation(.spring(response: 0.26, dampingFraction: 0.68), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == MentulStyle {
    static func mentul(_ skala: CGFloat = 0.96) -> MentulStyle { MentulStyle(skala: skala) }
}

/// Bentuk sudut lengkung fleksibel untuk pojok tertentu.
public struct CustomCornerShape: Shape {
    public var radius: CGFloat
    public var corners: UIRectCorner

    public init(radius: CGFloat, corners: UIRectCorner = .allCorners) {
        self.radius = radius
        self.corners = corners
    }

    public func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

/// Tinggi bilah status sungguhan, dibaca dari jendela aktif.
@MainActor
private func tinggiBilahStatus() -> CGFloat {
    let jendela = UIApplication.shared.connectedScenes
        .compactMap { ($0 as? UIWindowScene)?.windows.first { $0.isKeyWindow } ?? ($0 as? UIWindowScene)?.windows.first }
        .first
    return jendela?.safeAreaInsets.top ?? 0
}

/// Menjaga gestur geser-kembali (interactive pop gesture) tetap aktif.
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        viewControllers.count > 1
    }
}
