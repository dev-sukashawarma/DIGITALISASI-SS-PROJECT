import SwiftUI

/// Rasio lebar:tinggi banner carousel (gambar admin sebaiknya 1280×640).
let rasioBanner: CGFloat = 2

/// Padanan `BannerCarousel.kt`: carousel selebar layar, bergeser otomatis
/// tiap 4,5 detik. Dipanggil hanya saat `slides` tidak kosong.
struct BannerCarousel: View {
    let slides: [BannerDto]
    let onKetuk: (BannerDto) -> Void
    @State private var halaman = 0

    var body: some View {
        VStack(spacing: 10) {
            TabView(selection: $halaman) {
                ForEach(Array(slides.enumerated()), id: \.element.id) { i, slide in
                    Button { onKetuk(slide) } label: {
                        KartuBanner(slide: slide)
                            .padding(.horizontal, 16)
                    }
                    .buttonStyle(.mentul(0.98))
                    .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .aspectRatio(rasioBanner, contentMode: .fit)

            HStack(spacing: 5) {
                ForEach(slides.indices, id: \.self) { i in
                    Capsule()
                        .fill(i == halaman ? Color.sukaOrange : Color.sukaBorder.opacity(0.6))
                        .frame(width: i == halaman ? 20 : 6, height: 5)
                        .animation(.spring(response: 0.35, dampingFraction: 0.7), value: halaman)
                }
            }
            .accessibilityHidden(true)
        }
        .task(id: slides.count) {
            guard slides.count > 1 else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4.5))
                withAnimation(.easeInOut(duration: 0.35)) {
                    halaman = (halaman + 1) % slides.count
                }
            }
        }
    }
}

private struct KartuBanner: View {
    let slide: BannerDto

    var body: some View {
        // Latar cokelat terlihat selama gambar dimuat / bila tanpa gambar.
        GambarJarak(url: slide.gambarUrl, latar: .sukaBrown)
            .overlay {
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0.25),
                        .init(color: .black.opacity(0.78), location: 1.0)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.white.opacity(0.12), lineWidth: 1))
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 4) {
                    if let badge = slide.badge, !badge.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(badge)
                            .font(SukaFont.jakarta(10, weight: .bold))
                            .foregroundStyle(Color.sukaInk)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color.sukaOrange, in: Capsule())
                    }
                    Text(slide.judul)
                        .font(SukaFont.jakarta(16, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    if let sub = slide.subjudul, !sub.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(sub)
                            .font(SukaFont.jakarta(11))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                    if let tombol = slide.teksTombol, !tombol.trimmingCharacters(in: .whitespaces).isEmpty {
                        HStack(spacing: 4) {
                            Text(tombol).font(SukaFont.jakarta(11, weight: .bold))
                            Image(systemName: "arrow.right").font(.system(size: 9, weight: .bold))
                        }
                        .foregroundStyle(Color.sukaInk)
                        .padding(.horizontal, 12).padding(.vertical, 5)
                        .background(Color.sukaOrange, in: Capsule())
                        .padding(.top, 2)
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
            }
            .shadow(color: Color.sukaBrown.opacity(0.08), radius: 8, y: 3)
            .accessibilityElement(children: .combine)
    }
}
