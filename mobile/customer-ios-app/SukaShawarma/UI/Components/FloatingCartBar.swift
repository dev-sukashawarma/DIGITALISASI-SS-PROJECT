import SwiftUI

/// Padanan `FloatingCartBar.kt`: pil keranjang melayang di Beranda & Menu.
struct FloatingCartBar: View {
    let porsi: Int
    let subtotal: Int64
    let onKlik: () -> Void

    var body: some View {
        Button(action: onKlik) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(SukaGradien.oranyePrimer)
                        .frame(width: 38, height: 38)
                    Image(systemName: "bag.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.sukaInk)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text("\(porsi) Item di Keranjang")
                        .font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(.white)
                    Text("Total: \(rupiah(subtotal))")
                        .font(SukaFont.jakarta(11, weight: .medium)).foregroundStyle(Color.sukaCreamTeks.opacity(0.9))
                }

                Spacer()

                HStack(spacing: 4) {
                    Text("Lihat").font(SukaFont.jakarta(12, weight: .bold))
                    Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(Color.sukaInk)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(SukaGradien.oranyePrimer, in: Capsule())
                .shadow(color: Color.sukaOrange.opacity(0.3), radius: 4, y: 1)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background {
                RoundedRectangle(cornerRadius: 22)
                    .fill(LinearGradient(colors: [Color(hex: "27150E"), Color(hex: "3C1F15")], startPoint: .topLeading, endPoint: .bottomTrailing))
            }
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Color.white.opacity(0.12), lineWidth: 1))
            .shadow(color: Color.sukaBrown.opacity(0.25), radius: 12, y: 5)
        }
        .buttonStyle(.mentul(0.98))
        .accessibilityIdentifier("bilah-keranjang")
        // Pil melayang menutupi isi menu bila ikut membesar tanpa batas.
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}
