import SwiftUI

/// Padanan `BottomNavTab` + `SukaBottomNavBar.kt`.
enum TabUtama: CaseIterable, Hashable {
    case beranda, menu, pesanan, profil

    var label: String {
        switch self {
        case .beranda: "Beranda"
        case .menu: "Menu"
        case .pesanan: "Pesanan"
        case .profil: "Profil"
        }
    }

    var ikon: String {
        switch self {
        case .beranda: "house.fill"
        case .menu: "fork.knife"
        case .pesanan: "list.bullet.rectangle.portrait.fill"
        case .profil: "person.fill"
        }
    }
}

struct SukaBottomNavBar: View {
    let terpilih: TabUtama
    let onPilih: (TabUtama) -> Void

    var body: some View {
        HStack {
            ForEach(TabUtama.allCases, id: \.self) { tab in
                ItemNav(tab: tab, aktif: tab == terpilih) { onPilih(tab) }
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 6)
        // Bilah tab dibatasi seperti UITabBar bawaan iOS; isi layar tetap
        // membesar penuh. Tanpa batas ini label terpotong jadi "Beran/da".
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                .fill(Color.white)
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                    .stroke(Color.black.opacity(0.04), lineWidth: 1))
                .shadow(color: Color.black.opacity(0.06), radius: 14, y: -3)
                .ignoresSafeArea(edges: .bottom)
        }
    }
}

private struct ItemNav: View {
    let tab: TabUtama
    let aktif: Bool
    let aksi: () -> Void

    var body: some View {
        Button(action: aksi) {
            VStack(spacing: 3) {
                ZStack {
                    if aktif {
                        Circle()
                            .fill(Color.sukaOrange.opacity(0.16))
                            .frame(width: 38, height: 38)
                            .transition(.scale.combined(with: .opacity))
                    }
                    Image(systemName: tab.ikon)
                        .font(.system(size: 18, weight: aktif ? .bold : .regular))
                        .scaleEffect(aktif ? 1.1 : 1.0)
                }
                .frame(width: 38, height: 38)

                Text(tab.label)
                    .font(SukaFont.jakarta(10.5, weight: aktif ? .bold : .medium))
                    .lineLimit(1)

                Capsule()
                    .fill(Color.sukaOrange)
                    .frame(width: aktif ? 12 : 0, height: 3)
                    .opacity(aktif ? 1 : 0)
            }
            .foregroundStyle(aktif ? Color.sukaBrown : Color.sukaMuted.opacity(0.85))
            .padding(.horizontal, 10)
            .animation(.spring(response: 0.28, dampingFraction: 0.65), value: aktif)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.label)
        .accessibilityIdentifier("tab-\(tab)")
        .accessibilityAddTraits(aktif ? .isSelected : [])
    }
}
