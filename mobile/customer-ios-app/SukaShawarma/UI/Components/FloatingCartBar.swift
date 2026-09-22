import SwiftUI

/// Padanan `FloatingCartBar.kt`: pil keranjang melayang di Beranda & Menu.
struct FloatingCartBar: View {
    let porsi: Int
    let subtotal: Int64
    let onKlik: () -> Void

    var body: some View {
        Button(action: onKlik) {
            HStack {
                HStack(spacing: 12) {
                    Image(systemName: "bag.fill")
                        .font(.system(size: 17))
                        .foregroundStyle(Color.sukaInk)
                        .frame(width: 38, height: 38)
                        .background(Color.sukaOrange, in: Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(porsi) Item di Keranjang")
                            .font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(.white)
                        Text("Total: \(rupiah(subtotal))")
                            .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaCreamTeks.opacity(0.85))
                    }
                }
                Spacer()
                HStack(spacing: 4) {
                    Text("Lihat Keranjang").font(SukaFont.jakarta(11, weight: .bold))
                    Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(Color.sukaInk)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Color.sukaOrange, in: Capsule())
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(Color.sukaBrown, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.sukaBrownTepi, lineWidth: 1))
            .bayangan(8)
        }
        .buttonStyle(.mentul(0.98))
        .accessibilityIdentifier("bilah-keranjang")
        // Pil melayang menutupi isi menu bila ikut membesar tanpa batas.
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}
