import SwiftUI

/// Padanan `ui/home/HomeScreen.kt` — tab Beranda.
struct HomeView: View {
    let vm: CatalogViewModel
    var unreadCount = 0
    let onGantiOutlet: () -> Void
    let onBukaProfil: () -> Void
    let onBukaMenu: () -> Void
    let onPilihItem: (MenuItemDto) -> Void
    let onBukaNotifikasi: () -> Void
    /// Ketukan banner carousel. Popup promo ditangani shell (`AppShell`) agar
    /// latar gelapnya menutupi SELURUH layar termasuk bilah bawah, seperti
    /// `Dialog` di Android.
    let onKetukBanner: (TujuanBanner) -> Void

    var body: some View {
        ZStack {
            Color.sukaCream.ignoresSafeArea()
            isi
        }
        .latarBilahStatus()
    }

    @ViewBuilder private var isi: some View {
        if vm.memuat {
            ScrollView { RangkaBeranda() }.scrollDisabled(true)
        } else if vm.tidakAdaOutlet {
            EmptyState(judul: "Belum ada outlet",
                       penjelasan: "Pemesanan lewat aplikasi belum dibuka di outlet mana pun. Coba lagi nanti.")
        } else if let galat = vm.galat {
            ErrorState(galat: galat) { Task { await vm.muat() } }
        } else if vm.perluPilihOutlet {
            // Tidak ada padanannya di Android (lihat RANCANGAN.md §8, Fase 2).
            EmptyState(judul: "Pilih outlet dulu",
                       penjelasan: "Pilih outlet tempat kamu akan mengambil pesanan untuk melihat menunya.",
                       tombol: ("Pilih Outlet", onGantiOutlet))
        } else if let outlet = vm.outlet, !outlet.isActive {
            OutletClosedView(namaOutlet: outlet.name, onGantiOutlet: onGantiOutlet)
        } else {
            daftar
        }
    }

    private var daftar: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                if let outlet = vm.outlet {
                    HomeBrandHeader(namaOutlet: outlet.name, buka: outlet.isActive, unreadCount: unreadCount,
                                    onGantiOutlet: onGantiOutlet, onBukaProfil: onBukaProfil,
                                    onBukaNotifikasi: onBukaNotifikasi)
                }
                // Tidak dirender sama sekali saat kosong: Beranda tanpa banner
                // aktif langsung ke menu tanpa ruang kosong.
                if !vm.bannerCarousel.isEmpty {
                    BannerCarousel(slides: vm.bannerCarousel) { b in
                        onKetukBanner(tujuanBanner(aksi: b.aksi, targetMenuItemId: b.targetMenuItemId))
                    }
                    .padding(.top, 12)
                }

                let terlaris = pilihMenuTerlaris(vm.semuaItem)
                if !terlaris.isEmpty {
                    BagianTerlaris(items: terlaris, onLihatSemua: onBukaMenu, onPilih: onPilihItem)
                }
                BannerKisahRasa(onKetuk: onBukaMenu).padding(.horizontal, 16)
                KartuJelajahMenu(onKetuk: onBukaMenu).padding(.horizontal, 16)
            }
            .padding(.bottom, 96)
        }
        .scrollIndicators(.hidden)
        .refreshable { await vm.muat() }
    }
}

private struct BagianTerlaris: View {
    let items: [MenuItemDto]
    let onLihatSemua: () -> Void
    let onPilih: (MenuItemDto) -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text("🔥 Menu Terlaris (Best Seller)").font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk)
                    Text("Paling dicari & favorit pelanggan").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                }
                Spacer()
                Button(action: onLihatSemua) {
                    HStack(spacing: 2) {
                        Text("Lihat Semua").font(SukaFont.jakarta(11, weight: .bold))
                        Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(Color.sukaOrangeTeks)
                    .frame(minHeight: 44)
                    .padding(.horizontal, 8)
                }
            }
            .padding(.horizontal, 16)

            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(items.prefix(2).enumerated()), id: \.element.id) { i, item in
                    // Rating & ulasan: angka kurasi statis, disalin dari Android apa adanya.
                    KartuTerlaris(item: item, peringkat: i + 1,
                                  rating: i == 0 ? "4.9" : "4.8", ulasan: i == 0 ? "480+" : "320+",
                                  onKlik: onPilih)
                        .frame(maxWidth: .infinity)
                }
                if items.count == 1 { Color.clear.frame(maxWidth: .infinity) }
            }
            .padding(.horizontal, 16)
        }
    }
}

private struct KartuTerlaris: View {
    let item: MenuItemDto
    let peringkat: Int
    let rating: String
    let ulasan: String
    let onKlik: (MenuItemDto) -> Void

    var body: some View {
        Button { onKlik(item) } label: {
            VStack(alignment: .leading, spacing: 0) {
                GambarJarak(url: item.imageUrl)
                    .frame(height: 82)
                    .overlay(alignment: .topLeading) {
                        Text("Best Seller #\(peringkat)").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(Color.sukaBrown.opacity(0.88), in: RoundedRectangle(cornerRadius: 6))
                            .padding(8)
                    }
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, topTrailingRadius: 16))

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 2) {
                        Text("★ \(rating)").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaOrangeTeks)
                        Text("(\(ulasan))").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                    Text(item.name).font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaInk).lineLimit(1)
                    if let d = item.description {
                        Text(d).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted).lineLimit(1)
                    }
                    HStack {
                        Text(rupiah(item.price)).font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        Spacer()
                        Image(systemName: "plus").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.sukaInk)
                            .frame(width: 32, height: 32).background(Color.sukaOrange, in: Circle())
                            .frame(width: 44, height: 44)
                    }
                }
                .padding(8)
            }
            .kartuSuka(sudut: 16, elevasi: 3)
        }
        .buttonStyle(.mentul(0.97))
        .accessibilityLabel("Best seller \(peringkat): \(item.name), \(rupiah(item.price))")
    }
}

/// `SecondaryMediaBanner` — cerita merek, sengaja statis (keputusan owner).
private struct BannerKisahRasa: View {
    let onKetuk: () -> Void

    var body: some View {
        Button(action: onKetuk) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("⭐ JAMINAN KUALITAS SUKA").font(SukaFont.jakarta(11, weight: .bold)).tracking(0.5)
                        .foregroundStyle(Color.sukaOrange)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.sukaOrange.opacity(0.25), in: RoundedRectangle(cornerRadius: 8))
                    Spacer()
                    HStack(spacing: 2) {
                        Text("Kisah Rasa").font(SukaFont.jakarta(11, weight: .bold))
                        Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(Color.sukaOrange)
                }
                Text("100% Daging Segar & Rempah Asli Dipanggang")
                    .font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaCreamTeks)
                Text("Flatbread hangat & saus garlic toum otentik tanpa pengawet.")
                    .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaCreamTeks.opacity(0.85))
            }
            .multilineTextAlignment(.leading)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.sukaBrown, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.sukaBrownTepi.opacity(0.6), lineWidth: 1))
            .bayangan(4)
        }
        .buttonStyle(.mentul(0.98))
    }
}

private struct KartuJelajahMenu: View {
    let onKetuk: () -> Void

    var body: some View {
        Button(action: onKetuk) {
            HStack {
                HStack(spacing: 12) {
                    Image(systemName: "fork.knife").font(.system(size: 19)).foregroundStyle(Color.sukaOrange)
                        .frame(width: 44, height: 44).background(Color.sukaTint, in: Circle())
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Jelajahi Menu Lengkap").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                        Text("Pilih shawarma, kombo, & minuman").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                }
                Spacer()
                HStack(spacing: 4) {
                    Text("Buka Menu").font(SukaFont.jakarta(11, weight: .bold))
                    Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(Color.sukaInk)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: 12))
            }
            .padding(16)
            .kartuSuka(sudut: 20, elevasi: 2)
        }
        .buttonStyle(.mentul(0.98))
    }
}
