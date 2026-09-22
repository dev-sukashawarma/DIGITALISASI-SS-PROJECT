import SwiftUI

/// Padanan `ui/menu/MenuScreen.kt` — tab Menu: katalog per kategori dengan
/// chip kategori yang mengikuti posisi gulir ("scroll-spy") dan bisa diketuk
/// untuk melompat.
struct MenuView: View {
    @Bindable var vm: CatalogViewModel
    let onGantiOutlet: () -> Void
    let onBukaProfil: () -> Void
    let onPilihItem: (MenuItemDto) -> Void

    /// Id baris teratas yang terlihat (judul kategori "h:<kunci>" atau menu "m:<id>").
    @State private var posisiGulir: String?

    /// Indeks kategori aktif = kategori pemilik baris teratas yang terlihat.
    private var kategoriAktif: Int {
        guard let id = posisiGulir else { return 0 }
        for (i, k) in vm.kategori.enumerated() {
            if id == "h:\(k.kunci)" || k.items.contains(where: { "m:\(k.kunci):\($0.id)" == id }) { return i }
        }
        return 0
    }

    private var tampilkanChip: Bool { !vm.kategori.isEmpty && !vm.memuat && vm.galat == nil }

    var body: some View {
        VStack(spacing: 0) {
            if let outlet = vm.outlet {
                MenuBrandHeader(namaOutlet: outlet.name, kueri: $vm.kueri,
                                onGantiOutlet: onGantiOutlet, onBukaProfil: onBukaProfil) {
                    if tampilkanChip {
                        BarisChipKategori(nama: vm.kategori.map(\.nama), aktif: kategoriAktif) { i in
                            withAnimation(.easeInOut(duration: 0.3)) { posisiGulir = "h:\(vm.kategori[i].kunci)" }
                        }
                    }
                }
            }

            if vm.keranjangDikosongkan {
                SpandukKeranjangDikosongkan(onTutup: vm.akuiKeranjangDikosongkan)
            }

            isi.frame(maxHeight: .infinity)
        }
        .background(Color.sukaCream.ignoresSafeArea())
    }

    @ViewBuilder private var isi: some View {
        if vm.memuat {
            MemuatState()
        } else if vm.tidakAdaOutlet {
            EmptyState(judul: "Belum ada outlet",
                       penjelasan: "Pemesanan lewat aplikasi belum dibuka di outlet mana pun. Coba lagi nanti.")
        } else if let galat = vm.galat {
            ErrorState(galat: galat) { Task { await vm.muat() } }
        } else if vm.perluPilihOutlet {
            EmptyState(judul: "Pilih outlet dulu",
                       penjelasan: "Menu berbeda di tiap outlet. Pilih outlet untuk melihat menunya.",
                       tombol: ("Pilih Outlet", onGantiOutlet))
        } else if let outlet = vm.outlet, !outlet.isActive {
            OutletClosedView(namaOutlet: outlet.name, onGantiOutlet: onGantiOutlet)
        } else if vm.kategori.isEmpty {
            if vm.kueri.trimmingCharacters(in: .whitespaces).isEmpty {
                EmptyState(judul: "Menu belum terbit", penjelasan: "Outlet ini belum menerbitkan menu ke aplikasi.")
            } else {
                EmptyState(judul: "Tidak ditemukan", penjelasan: "Tidak ada menu yang cocok dengan \"\(vm.kueri)\".")
            }
        } else {
            ScrollView {
                LazyVStack(spacing: 14) {
                    ForEach(vm.kategori) { k in
                        HStack {
                            Text(k.nama).font(SukaFont.jakarta(16, weight: .bold)).foregroundStyle(Color.sukaInk)
                                .accessibilityAddTraits(.isHeader)
                            Spacer()
                            Text("\(k.items.count) pilihan").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        }
                        .padding(.horizontal, 18).padding(.top, 2)
                        .id("h:\(k.kunci)")

                        ForEach(k.items) { m in
                            MenuCard(item: m, onKlik: onPilihItem)
                                .padding(.horizontal, 16)
                                .id("m:\(k.kunci):\(m.id)")
                        }
                    }
                }
                .scrollTargetLayout()
                .padding(.top, 12).padding(.bottom, 96)
            }
            .scrollPosition(id: $posisiGulir, anchor: .top)
            .scrollDismissesKeyboard(.immediately)
        }
    }
}

private struct BarisChipKategori: View {
    let nama: [String]
    let aktif: Int
    let onPilih: (Int) -> Void

    var body: some View {
        ScrollViewReader { proksi in
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(Array(nama.enumerated()), id: \.offset) { i, n in
                        let dipilih = i == aktif
                        Button { onPilih(i) } label: {
                            Text(n).font(SukaFont.jakarta(12, weight: dipilih ? .bold : .medium))
                                .foregroundStyle(dipilih ? Color.sukaInk : Color.sukaCreamTeks)
                                .padding(.horizontal, 14).padding(.vertical, 6)
                                .background(dipilih ? Color.sukaOrange : Color.white.opacity(0.18), in: Capsule())
                                .overlay(Capsule().stroke(dipilih ? Color.sukaOrange : Color.white.opacity(0.28), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(dipilih ? .isSelected : [])
                        .id(i)
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 2)
            }
            .scrollIndicators(.hidden)
            .onChange(of: aktif) { _, baru in
                withAnimation { proksi.scrollTo(baru, anchor: .leading) }
            }
        }
    }
}

private struct SpandukKeranjangDikosongkan: View {
    let onTutup: () -> Void

    var body: some View {
        HStack {
            Text("Keranjang dikosongkan karena kamu berpindah outlet. Menu tiap outlet berbeda.")
                .font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaInk)
            Spacer(minLength: 8)
            Button("Mengerti", action: onTutup)
                .font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaBrown)
        }
        .padding(12)
        .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.sukaBorder, lineWidth: 1))
        .padding(.horizontal, 16).padding(.vertical, 6)
    }
}
