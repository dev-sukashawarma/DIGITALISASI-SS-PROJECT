import SwiftUI

/// Padanan `MenuCard.kt`: satu baris menu di katalog. Menu habis tetap tampil
/// (diredupkan + label "Habis"), tidak disembunyikan.
struct MenuCard: View {
    let item: MenuItemDto
    let onKlik: (MenuItemDto) -> Void

    var body: some View {
        Button { onKlik(item) } label: {
            HStack(spacing: 14) {
                ZStack(alignment: .bottom) {
                    GambarJarak(url: item.imageUrl, ikonCadangan: "fork.knife")
                        .frame(width: 88, height: 88)
                        .clipShape(RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(Color.black.opacity(0.04), lineWidth: 1))

                    if !item.isAvailable {
                        Text("Habis")
                            .font(SukaFont.jakarta(10, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 3)
                            .background(Color.black.opacity(0.7))
                            .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 15, bottomTrailingRadius: 15))
                    }
                }
                .frame(width: 88, height: 88)

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name)
                        .font(SukaFont.jakarta(15, weight: .bold))
                        .foregroundStyle(Color.sukaInk)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    if let d = item.description, !d.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(d)
                            .font(SukaFont.jakarta(12))
                            .foregroundStyle(Color.sukaMuted)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    Spacer(minLength: 2)

                    HStack {
                        Text(rupiah(item.price))
                            .font(SukaFont.lilita(16))
                            .foregroundStyle(Color.sukaBrown)
                        Spacer()
                        if item.isAvailable {
                            Image(systemName: "plus")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(Color.sukaInk)
                                .frame(width: 32, height: 32)
                                .background(SukaGradien.oranyePrimer, in: Circle())
                                .shadow(color: Color.sukaOrange.opacity(0.35), radius: 3, y: 1)
                                .frame(width: 44, height: 44)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .opacity(item.isAvailable ? 1 : 0.55)
            .kartuElegan(sudut: 18, elevasi: 2, latar: .white)
        }
        .buttonStyle(.mentul(0.97))
        .disabled(!item.isAvailable)
        .accessibilityIdentifier("kartu-menu")
        .accessibilityLabel("\(item.name), \(rupiah(item.price))\(item.isAvailable ? "" : ", habis")")
    }
}
