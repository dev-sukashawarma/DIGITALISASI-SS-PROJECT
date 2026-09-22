import SwiftUI

/// Padanan `navigation/AppNavigation.kt` (`CustomerAppRoot`).
///
/// SATU `NavigationStack` dengan isi akar berganti per tab, bilah bawah
/// kustom hanya tampil di akar — meniru Android persis (satu NavHost, bilah
/// bawah hanya di rute tingkat atas). Sengaja bukan `TabView`: TabView
/// menyimpan tumpukan terpisah per tab, perilaku yang tidak ada di Android.
///
/// `CatalogViewModel` dibuat di sini, BUKAN per layar: katalog tidak hilang
/// saat berpindah tab, dan keranjang punya satu sumber kebenaran (`CartStore`).
struct AppShell: View {
    @Environment(AppContainer.self) private var container
    @State private var tab: TabUtama = .beranda
    @State private var jalur: [Rute] = []
    @State private var tampilPilihOutlet = false
    @State private var catalog: CatalogViewModel?
    @State private var popupDilihat: Set<String> = []

    var body: some View {
        Group {
            if let catalog {
                shell(catalog)
            } else {
                Color.sukaCream.ignoresSafeArea()
            }
        }
        .task {
            // Fase 2: selalu mulai di Beranda. Di Android, tanpa sesi aplikasi
            // mulai di layar Masuk — gerbang itu dipasang di Fase 3 (login).
            guard catalog == nil else { return }
            let vm = CatalogViewModel(repository: container.repository,
                                      outletStore: container.outletStore, cart: container.cartStore)
            catalog = vm
            // Titik di lonceng Beranda: hanya bila ada sesi (sama dengan Android).
            if container.sesiBerlaku(), case .sukses(let n) = await container.repository.ambilNotifikasi() {
                container.notificationStore.setUnreadCount(n.unreadCount)
            }
            await vm.muat()
        }
    }

    private func shell(_ catalog: CatalogViewModel) -> some View {
        NavigationStack(path: $jalur) {
            akar(catalog)
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: Rute.self) { tujuan(catalog, $0) }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if jalur.isEmpty {
                VStack(spacing: 10) {
                    let porsi = container.cartStore.jumlahPorsi()
                    if (tab == .beranda || tab == .menu) && porsi > 0 {
                        FloatingCartBar(porsi: porsi, subtotal: container.cartStore.subtotal()) {
                            jalur.append(.keranjang)
                        }
                        .padding(.horizontal, 16)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                    SukaBottomNavBar(terpilih: tab) { tab = $0 }
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .overlay {
            if let popup = popupAktif(catalog) {
                PromoPopup(banner: popup) {
                    tandaiPopup(popup)
                } onKlaim: {
                    tandaiPopup(popup)
                    bukaTujuan(catalog, tujuanBanner(aksi: popup.aksi, targetMenuItemId: popup.targetMenuItemId))
                }
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .animation(.easeOut(duration: 0.2), value: popupAktif(catalog)?.id)
        .onAppear { popupDilihat = container.bannerDilihatStore.sudahDilihat() }
        .animation(.easeOut(duration: 0.25), value: jalur.isEmpty)
        .animation(.easeOut(duration: 0.24), value: container.cartStore.jumlahPorsi() > 0)
        .fullScreenCover(isPresented: $tampilPilihOutlet) {
            OutletPickerView(vm: OutletPickerViewModel(repository: container.repository)) { o in
                tampilPilihOutlet = false
                Task { await catalog.pilihOutlet(o) }
            } onTutup: {
                tampilPilihOutlet = false
            }
        }
    }

    /// Popup tampil di Beranda saja, sekali per banner per pelanggan (K3),
    /// dan hanya setelah katalog outlet berhasil dimuat.
    private func popupAktif(_ catalog: CatalogViewModel) -> BannerDto? {
        guard tab == .beranda, jalur.isEmpty, !tampilPilihOutlet,
              let p = catalog.bannerPopup, popupBolehTampil(popupId: p.id, sudahDilihat: popupDilihat),
              catalog.outlet != nil, !catalog.memuat, catalog.galat == nil else { return nil }
        return p
    }

    private func tandaiPopup(_ popup: BannerDto) {
        container.bannerDilihatStore.tandai(popup.id)
        popupDilihat = container.bannerDilihatStore.sudahDilihat()
    }

    /// Menu tujuan yang tak ada di katalog outlet ini jatuh ke tab Menu —
    /// ketukan yang tidak melakukan apa pun terbaca sebagai aplikasi rusak.
    private func bukaTujuan(_ catalog: CatalogViewModel, _ tujuan: TujuanBanner) {
        switch tujuan {
        case .tidakAda: break
        case .menu: tab = .menu
        case .item(let id):
            if catalog.semuaItem.contains(where: { $0.id == id }) {
                jalur.append(.detail(menuItemId: id))
            } else {
                tab = .menu
            }
        }
    }

    @ViewBuilder private func akar(_ catalog: CatalogViewModel) -> some View {
        switch tab {
        case .beranda:
            HomeView(vm: catalog, unreadCount: container.notificationStore.unreadCount,
                     onGantiOutlet: { tampilPilihOutlet = true },
                     onBukaProfil: { tab = .profil },
                     onBukaMenu: { tab = .menu },
                     onPilihItem: { jalur.append(.detail(menuItemId: $0.id)) },
                     onBukaNotifikasi: { jalur.append(.notifikasi) },
                     onKetukBanner: { bukaTujuan(catalog, $0) })
        case .menu:
            MenuView(vm: catalog,
                     onGantiOutlet: { tampilPilihOutlet = true },
                     onBukaProfil: { tab = .profil },
                     onPilihItem: { jalur.append(.detail(menuItemId: $0.id)) })
        case .pesanan:
            HistoryView(vm: HistoryViewModel(repository: container.repository),
                        onBukaPesanan: { jalur.append(.status(orderId: $0)) },
                        onBukaProfil: { tab = .profil },
                        onMasuk: { jalur.append(.masuk(tujuan: .katalog)) })
        case .profil:
            ProfilTab(onBukaInfoAkun: { jalur.append(.infoAkun) },
                      onLihatRiwayat: { tab = .pesanan },
                      onMasuk: { jalur.append(.masuk(tujuan: .katalog)) },
                      namaOutlet: catalog.outlet?.name) {
                container.sessionStore.hapus()
                container.notificationStore.setUnreadCount(0)
                // Android membawa ke layar Masuk; di iOS layar itu belum ada (Fase 3).
                jalur = []
                tab = .beranda
            }
        }
    }

    @ViewBuilder private func tujuan(_ catalog: CatalogViewModel, _ rute: Rute) -> some View {
        let kembali = { _ = jalur.popLast() }
        switch rute {
        case .detail(let id):
            // Item bisa hilang kalau katalog dimuat ulang selagi detail terbuka.
            if let item = catalog.semuaItem.first(where: { $0.id == id }) {
                ItemDetailView(item: item, toppingTersedia: toppingUntuk(item, semua: catalog.semuaItem),
                               cart: container.cartStore,
                               onLihatKeranjang: { jalur.append(.keranjang) },
                               onKembali: kembali)
            } else {
                VStack(spacing: 0) {
                    PageBrandHeader(judul: "Detail Menu", onKembali: kembali)
                    EmptyState(judul: "Menu tidak ditemukan",
                               penjelasan: "Menu ini sudah tidak ada di katalog outlet.")
                        .frame(maxHeight: .infinity)
                }
                .background(Color.sukaCream.ignoresSafeArea())
                .toolbar(.hidden, for: .navigationBar)
            }
        case .keranjang:
            CartView(cart: container.cartStore, onKembali: kembali) {
                // Login diminta DI SINI, di titik bayar — bukan di pintu masuk.
                // Pelanggan boleh menyusun keranjang tanpa akun; `checkout/validate`
                // yang menuntut sesi.
                jalur.append(container.sesiBerlaku() ? .checkout : .masuk(tujuan: .checkout))
            }
        case .checkout:
            CheckoutView(vm: CheckoutViewModel(repository: container.repository, cart: container.cartStore),
                         onKembali: kembali,
                         onBayar: { jalur.append(.bayar) },
                         onSesiHabis: {
                             container.sessionStore.hapus()
                             jalur.removeLast()
                             jalur.append(.masuk(tujuan: .checkout))
                         })
        case .masuk(let tujuan):
            LoginView(vm: LoginViewModel(repository: container.repository, sessionStore: container.sessionStore),
                      googleClientID: container.config.googleIOSClientID,
                      onBerhasil: {
                          // Masuk dari titik bayar kembali ke titik bayar, bukan ke katalog.
                          _ = jalur.popLast()
                          if tujuan == .checkout { jalur.append(.checkout) }
                          Task {
                              if case .sukses(let n) = await container.repository.ambilNotifikasi() {
                                  container.notificationStore.setUnreadCount(n.unreadCount)
                              }
                          }
                      },
                      onKembali: kembali)
        case .bayar:
            PaymentWaitView(vm: PaymentViewModel(repository: container.repository, cart: container.cartStore,
                                                 percobaan: container.orderAttemptStore),
                            onSelesai: { id, nomor in
                                // Riwayat navigasi diganti: tombol kembali dari layar
                                // sukses tak boleh membawa ke halaman bayar lagi.
                                jalur = [.sukses(orderId: id, nomor: nomor)]
                            },
                            onKembaliKeRingkasan: kembali,
                            onLihatRiwayat: { jalur = []; tab = .pesanan })
        case .sukses(let id, let nomor):
            SuccessView(nomorPesanan: nomor, namaOutlet: catalog.outlet?.name,
                        onLihatStatus: { jalur.append(.status(orderId: id)) },
                        onKembaliKeMenu: { jalur = []; tab = .beranda })
        case .status(let id):
            OrderStatusView(vm: OrderStatusViewModel(repository: container.repository, orderId: id), onKembali: kembali)
        case .infoAkun:
            InformasiAkunView(vm: InformasiAkunViewModel(repository: container.repository,
                                                         sessionStore: container.sessionStore),
                              onKembali: kembali)
        case .notifikasi:
            NotificationView(vm: NotificationViewModel(repository: container.repository, store: container.notificationStore),
                             onBukaStatusPesanan: { jalur.append(.status(orderId: $0)) },
                             onBukaMenu: { jalur = []; tab = .menu },
                             onKembali: kembali)
        }
    }
}

/// Tab Profil: membaca sesi setiap kali tampil (nama bisa baru diubah di
/// Informasi Akun) dan menghitung pesanan selesai dari riwayat sungguhan.
private struct ProfilTab: View {
    @Environment(AppContainer.self) private var container
    let onBukaInfoAkun: () -> Void
    let onLihatRiwayat: () -> Void
    let onMasuk: () -> Void
    let namaOutlet: String?
    let onKeluar: () -> Void

    @State private var sesi: SessionData?
    @State private var jumlahSelesai: Int?

    var body: some View {
        ProfileView(sesi: sesi, jumlahSelesai: jumlahSelesai, namaOutlet: namaOutlet,
                    notificationStore: container.notificationStore,
                    onSimpanPreferensi: { pesanan, promo in
                        container.notificationStore.simpanPreferensi(statusPesanan: pesanan, promo: promo)
                        Task { _ = await container.repository.simpanPreferensiNotifikasi(pesanan: pesanan, promo: promo) }
                    },
                    onBukaInfoAkun: onBukaInfoAkun, onLihatRiwayat: onLihatRiwayat, onMasuk: onMasuk,
                    onKeluar: {
                        onKeluar()
                        sesi = nil
                    })
            .task {
                sesi = container.sesiBerlaku() ? container.sessionStore.baca() : nil
                guard sesi != nil else { return }
                if case .sukses(let r) = await container.repository.riwayat() {
                    jumlahSelesai = r.filter { tampilanStatus($0.statusDapur).selesai }.count
                }
            }
    }
}
