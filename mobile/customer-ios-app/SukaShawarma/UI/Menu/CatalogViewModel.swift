import Foundation
import Observation

/// Padanan `ui/menu/CatalogViewModel.kt`. Dimiliki shell navigasi (bukan tiap
/// layar), dipakai bersama tab Beranda & Menu: katalog yang sudah dimuat tidak
/// hilang saat pelanggan berpindah tab.
@MainActor
@Observable
final class CatalogViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    private(set) var outlet: OutletDto?
    var kueri = "" { didSet { if kueri != oldValue { susunKategori() } } }
    private(set) var semuaItem: [MenuItemDto] = []
    private(set) var kategori: [KategoriMenu] = []
    /// Ada >1 outlet, tak ada yang tersimpan — pelanggan harus memilih.
    private(set) var perluPilihOutlet = false
    /// Tidak ada satu pun outlet yang ikut serta di aplikasi.
    private(set) var tidakAdaOutlet = false
    /// Keranjang terhapus karena pelanggan berpindah outlet.
    private(set) var keranjangDikosongkan = false
    private(set) var bannerCarousel: [BannerDto] = []
    private(set) var bannerPopup: BannerDto?

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let outletStore: OutletStore
    @ObservationIgnored private let cart: CartStore
    @ObservationIgnored private var tugasBanner: Task<Void, Never>?

    init(repository: Repository, outletStore: OutletStore, cart: CartStore) {
        self.repository = repository
        self.outletStore = outletStore
        self.cart = cart
    }

    func muat() async {
        memuat = true
        galat = nil
        perluPilihOutlet = false
        tidakAdaOutlet = false

        switch await repository.outlets() {
        case .gagal(let g):
            memuat = false
            galat = g
        case .sukses(let outlets):
            // Banner tidak boleh menjatuhkan ATAU menahan Beranda: dimuat
            // terpisah, gagal = tanpa banner, lambat = katalog tak menunggu.
            tugasBanner?.cancel()
            tugasBanner = Task { [repository] in
                if case .sukses(let b) = await repository.banners() {
                    bannerCarousel = b.carousel
                    bannerPopup = b.popup
                }
            }

            guard !outlets.isEmpty else {
                memuat = false
                tidakAdaOutlet = true
                return
            }

            // Outlet tersimpan yang sudah dicabut dari aplikasi tidak boleh tetap dipakai.
            let tersimpan = outletStore.idTerpilih()
            guard let terpilih = outlets.first(where: { $0.id == tersimpan })
                    ?? (outlets.count == 1 ? outlets[0] : nil)
            else {
                memuat = false
                perluPilihOutlet = true
                return
            }

            outletStore.simpan(id: terpilih.id, nama: terpilih.name)
            pasangOutletKeKeranjang(terpilih.id)
            await muatKatalog(terpilih)
        }
    }

    func pilihOutlet(_ o: OutletDto) async {
        outletStore.simpan(id: o.id, nama: o.name)
        pasangOutletKeKeranjang(o.id)
        memuat = true
        galat = nil
        perluPilihOutlet = false
        outlet = o
        semuaItem = []
        kategori = []
        await muatKatalog(o)
    }

    func akuiKeranjangDikosongkan() { keranjangDikosongkan = false }

    /// Keranjang outlet lain pasti ditolak gateway saat checkout — lebih baik
    /// dikosongkan di sini, selagi pelanggan masih bisa memesan ulang.
    private func pasangOutletKeKeranjang(_ outletId: String) {
        if cart.pakaiOutlet(outletId) { keranjangDikosongkan = true }
    }

    private func susunKategori() {
        kategori = kelompokkanPerKategori(saringPencarian(semuaItem, kueri: kueri))
    }

    private func muatKatalog(_ o: OutletDto) async {
        switch await repository.katalog(outletId: o.id) {
        case .gagal(let g):
            // Outlet tetap dipasang walau katalog gagal: tombol "Ganti" harus
            // tetap bisa dipakai, kalau tidak pelanggan terjebak.
            memuat = false
            outlet = o
            galat = g
        case .sukses(let items):
            memuat = false
            galat = nil
            outlet = o
            semuaItem = items
            susunKategori()
        }
    }
}
