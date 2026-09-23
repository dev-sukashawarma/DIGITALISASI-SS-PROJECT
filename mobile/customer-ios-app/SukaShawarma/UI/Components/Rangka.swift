import SwiftUI

/// Padanan `ui/components/Rangka.kt`: kerangka berdenyut yang menunjukkan
/// BENTUK isi yang akan datang, bukan lingkaran berputar di layar kosong.
struct KotakRangka: View {
    var lebar: CGFloat?
    let tinggi: CGFloat
    var sudut: CGFloat = 8
    var warna: Color = .sukaTint
    @State private var redup = false

    var body: some View {
        RoundedRectangle(cornerRadius: sudut)
            .fill(warna)
            .frame(width: lebar, height: tinggi)
            .frame(maxWidth: lebar == nil ? .infinity : nil, alignment: .leading)
            .opacity(redup ? 0.45 : 1)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { redup = true }
            }
    }
}

/// Rangka Beranda — tampil tepat setelah splash selagi katalog & banner diambil.
struct RangkaBeranda: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    KotakRangka(lebar: 48, tinggi: 48, sudut: 14, warna: .sukaBorder)
                    VStack(alignment: .leading, spacing: 6) {
                        KotakRangka(lebar: 180, tinggi: 18, warna: .sukaBorder)
                        KotakRangka(lebar: 130, tinggi: 12, warna: .sukaBorder)
                    }
                }
                KotakRangka(tinggi: 64, sudut: 16, warna: .sukaCard)
            }
            .padding(16)
            .background(Color.sukaTint, in: UnevenRoundedRectangle(bottomLeadingRadius: 24, bottomTrailingRadius: 24))

            VStack(alignment: .leading, spacing: 12) {
                KotakRangka(lebar: 200, tinggi: 20)
                KotakRangka(lebar: 150, tinggi: 12)
                HStack(spacing: 12) {
                    ForEach(0..<2, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: 8) {
                            KotakRangka(tinggi: 82, sudut: 16)
                            KotakRangka(lebar: 90, tinggi: 12)
                            KotakRangka(tinggi: 14)
                            KotakRangka(lebar: 80, tinggi: 16)
                        }
                    }
                }
                KotakRangka(tinggi: 120, sudut: 20)
                KotakRangka(tinggi: 96, sudut: 20, warna: .sukaCard)
            }
            .padding(16)
        }
        // Satu label untuk seluruh rangka, bukan belasan kotak kosong.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Memuat beranda")
    }
}
