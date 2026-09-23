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
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 4)
        // Bilah tab dibatasi seperti UITabBar bawaan iOS; isi layar tetap
        // membesar penuh. Tanpa batas ini label terpotong jadi "Beran/da".
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22)
                .fill(Color.white)
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22)
                    .stroke(Color.sukaBorder.opacity(0.6), lineWidth: 1))
                .shadow(color: .black.opacity(0.08), radius: 10, y: -2)
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
            VStack(spacing: 2) {
                Image(systemName: tab.ikon)
                    .font(.system(size: 19))
                    .scaleEffect(aktif ? 1.1 : 1)
                Text(tab.label)
                    .font(SukaFont.jakarta(11, weight: aktif ? .bold : .medium))
                    .lineLimit(1)
                Circle()
                    .fill(Color.sukaOrange)
                    .frame(width: 4, height: 4)
                    .scaleEffect(aktif ? 1 : 0.4)
                    .opacity(aktif ? 1 : 0)
            }
            // SukaBrown di atas putih = 11,6:1 (lulus WCAG AA).
            .foregroundStyle(aktif ? Color.sukaBrown : Color.sukaMuted)
            .padding(.horizontal, 14).padding(.vertical, 4)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: aktif)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.label)
        .accessibilityIdentifier("tab-\(tab)")
        .accessibilityAddTraits(aktif ? .isSelected : [])
    }
}
