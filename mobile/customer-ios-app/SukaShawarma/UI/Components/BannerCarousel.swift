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
        VStack(spacing: 8) {
            TabView(selection: $halaman) {
                ForEach(Array(slides.enumerated()), id: \.element.id) { i, slide in
                    Button { onKetuk(slide) } label: { KartuBanner(slide: slide) }
                        .buttonStyle(.mentul(0.98))
                        .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .aspectRatio(rasioBanner, contentMode: .fit)

            HStack(spacing: 4) {
                ForEach(slides.indices, id: \.self) { i in
                    Capsule()
                        .fill(i == halaman ? Color.sukaOrange : Color.sukaBorder.opacity(0.8))
                        .frame(width: i == halaman ? 18 : 5, height: 5)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: halaman)
            .accessibilityHidden(true)
        }
        .task(id: slides.count) {
            guard slides.count > 1 else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(4.5))
                withAnimation { halaman = (halaman + 1) % slides.count }
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
                LinearGradient(stops: [.init(color: .clear, location: 0.35),
                                       .init(color: .black.opacity(0.72), location: 1)],
                               startPoint: .top, endPoint: .bottom)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 4) {
                    if let badge = slide.badge, !badge.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(badge).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaInk)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: 8))
                    }
                    Text(slide.judul).font(SukaFont.jakarta(16, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                    if let sub = slide.subjudul, !sub.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(sub).font(SukaFont.jakarta(11)).foregroundStyle(.white.opacity(0.88)).lineLimit(1)
                    }
                    if let tombol = slide.teksTombol, !tombol.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(tombol).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaInk)
                            .padding(.horizontal, 12).padding(.vertical, 4)
                            .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: 12))
                            .padding(.top, 4)
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
                // Teks di atas gambar berukuran tetap 2:1 — dibatasi agar tak menabrak gambar.
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
            }
            .accessibilityElement(children: .combine)
    }
}
