import SwiftUI
import UIKit

/// Padanan `SplashAplikasiScreen.kt`: foto layar penuh yang diatur dari admin
/// dashboard, sebagai LAPISAN di atas aplikasi.
struct SplashAplikasiView: View {
    let gambar: UIImage
    let durasiMs: Int64
    let onSelesai: () -> Void

    @State private var muncul = false

    var body: some View {
        Color.sukaBrownDark
            .overlay {
                Image(uiImage: gambar)
                    .resizable()
                    .scaledToFill()
                    .scaleEffect(muncul ? 1.02 : 1.0)
                    .animation(.easeOut(duration: Double(durasiMs) / 1000.0), value: muncul)
            }
            .clipped()
            .ignoresSafeArea()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Suka Shawarma")
            .onAppear { muncul = true }
            .task {
                try? await Task.sleep(for: .milliseconds(durasiMs))
                onSelesai()
            }
    }
}

/// Lama minimum splash logo.
let durasiSplashMerekMs: Int64 = 1_500
/// Paling lama splash logo menunggu foto admin diunduh.
let batasTungguFotoSplashMs: Int64 = 5_000

/// Layar peluncuran Suka Shawarma: Elegan, hangat, dan beranimasi halus.
struct SplashMerekView: View {
    @State private var denyut = false
    @State private var muncul = false

    var body: some View {
        ZStack {
            // Latar gradasi hangat yang kaya dan elegan
            LinearGradient(
                colors: [Color(hex: 0x450C03), Color(hex: 0x6E1504), Color(hex: 0x500E03)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Aura cahaya radial lembut di belakang logo
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.sukaOrange.opacity(denyut ? 0.30 : 0.12), Color.clear],
                        center: .center,
                        startRadius: 10,
                        endRadius: 160
                    )
                )
                .frame(width: 320, height: 320)
                .scaleEffect(denyut ? 1.15 : 0.95)
                .animation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true), value: denyut)

            VStack(spacing: 24) {
                Spacer()

                // Logo Brand Suka Shawarma
                Image("LogoSplash")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 168, height: 168)
                    .scaleEffect(muncul ? 1.0 : 0.88)
                    .opacity(muncul ? 1.0 : 0.0)
                    .shadow(color: .black.opacity(0.35), radius: denyut ? 24 : 12, y: 8)
                    .animation(.spring(response: 0.7, dampingFraction: 0.75), value: muncul)

                Spacer()

                // Indikator Pemanis Memuat: Kapsul progress lembut
                VStack(spacing: 12) {
                    TitikMemuatElegan()

                    Text("Rasa Autentik Cepat Saji")
                        .font(SukaFont.jakarta(12, weight: .medium))
                        .foregroundStyle(Color.sukaCreamTeks.opacity(0.75))
                        .tracking(1.0)
                }
                .padding(.bottom, 64)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Suka Shawarma, memuat")
        .onAppear {
            muncul = true
            denyut = true
        }
    }
}

/// Indikator memuat minimalis beranimasi halus
private struct TitikMemuatElegan: View {
    @State private var geser = false

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { i in
                Capsule()
                    .fill(Color.sukaOrange)
                    .frame(width: geser ? 16 : 8, height: 7)
                    .opacity(geser ? 0.95 : 0.4)
                    .animation(
                        .easeInOut(duration: 0.55)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.18),
                        value: geser
                    )
            }
        }
        .onAppear { geser = true }
    }
}
