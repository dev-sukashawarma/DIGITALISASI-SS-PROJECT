import SwiftUI

/// Padanan `MenuCard.kt`: satu baris menu di katalog. Menu habis tetap tampil
/// (diredupkan + label "Habis"), tidak disembunyikan.
struct MenuCard: View {
    let item: MenuItemDto
    let onKlik: (MenuItemDto) -> Void

    var body: some View {
        Button { onKlik(item) } label: {
            HStack(spacing: 14) {
                GambarJarak(url: item.imageUrl, ikonCadangan: "fork.knife")
                    .frame(width: 88, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(alignment: .bottom) {
                        if !item.isAvailable {
                            Text("Habis").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity).padding(.vertical, 2)
                                .background(Color.black.opacity(0.65))
                                .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 14, bottomTrailingRadius: 14))
                        }
                    }

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name).font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    if let d = item.description, !d.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(d).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted)
                            .lineLimit(2).multilineTextAlignment(.leading)
                    }
                    HStack {
                        Text(rupiah(item.price)).font(SukaFont.lilita(16)).foregroundStyle(Color.sukaBrown)
                        Spacer()
                        if item.isAvailable {
                            Image(systemName: "plus").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.sukaInk)
                                .frame(width: 34, height: 34)
                                .background(Color.sukaOrange, in: Circle())
                                .frame(width: 44, height: 44)
                        }
                    }
                    .padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .opacity(item.isAvailable ? 1 : 0.45)
            .kartuSuka(sudut: 18, elevasi: 2, tepi: .sukaBorder.opacity(0.8))
        }
        .buttonStyle(.mentul(0.97))
        .disabled(!item.isAvailable)
        .accessibilityIdentifier("kartu-menu")
        .accessibilityLabel("\(item.name), \(rupiah(item.price))\(item.isAvailable ? "" : ", habis")")
    }
}
