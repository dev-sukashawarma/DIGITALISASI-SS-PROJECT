import Foundation
import Observation

/// Padanan `AppContainer.kt`: perakitan dependensi seadanya, tanpa kerangka DI.
/// Satu klien HTTP dan beberapa penyimpanan — kerangka DI hanya menambah lapisan.
///
@MainActor
@Observable
final class AppContainer {
    let config: AppConfig
    let sessionStore: SessionStore
    let outletStore: OutletStore
    let cartStore: CartStore
    let splashStore: SplashStore
    let bannerDilihatStore: BannerDilihatStore
    let orderAttemptStore: OrderAttemptStore
    let notificationStore: NotificationStore
    let lokasiPelanggan: LokasiPelanggan
    let repository: Repository
    /// Layar berlatar terang (Masuk) menyalakan ini agar ikon bilah status
    /// gelap; selebihnya putih di atas kepala cokelat. Dibaca `SukaShawarmaApp`.
    var ikonBilahStatusGelap = false

    /// Masih ada sesi yang layak dipakai? (Hanya kemudahan — gateway tetap penentu, lewat 401.)
    func sesiBerlaku() -> Bool {
        #if DEBUG
        if SkenarioUji.aktif { return true }
        #endif
        return sessionStore.adaSesiBerlaku()
    }

    init(config: AppConfig = .dariBundle()) {
        self.config = config
        let sessionStore = Self.buatSessionStore()
        self.sessionStore = sessionStore
        outletStore = OutletStore()
        cartStore = CartStore.persisten()
        #if DEBUG
        if SkenarioUji.aktif {
            SkenarioUji.siapkanKeranjang(cartStore)
        }
        #endif
        splashStore = SplashStore()
        bannerDilihatStore = BannerDilihatStore()
        orderAttemptStore = OrderAttemptStore()
        notificationStore = NotificationStore()
        lokasiPelanggan = LokasiPelanggan(nonaktif: Self.lokasiNonaktif)
        let gateway = GatewayClient(baseURL: config.gatewayBaseURL,
                                    token: { sessionStore.baca()?.token },
                                    session: Self.buatSesiJaringan())
        repository = Repository(gateway: gateway)
    }

    /// Sesi sungguhan di Keychain — kecuali saat skenario uji (Debug saja).
    private static func buatSessionStore() -> SessionStore {
        #if DEBUG
        if SkenarioUji.aktif { return SkenarioUji.siapkanSesi() }
        #endif
        return SessionStore()
    }

    /// Skenario uji UI: dialog izin lokasi sistem menutupi layar yang diuji.
    private static var lokasiNonaktif: Bool {
        #if DEBUG
        return SkenarioUji.aktif
        #else
        return false
        #endif
    }

    /// nil = URLSession bawaan GatewayClient (batas waktu 15 dtk).
    private static func buatSesiJaringan() -> URLSession? {
        #if DEBUG
        if SkenarioUji.aktif {
            let konfig = URLSessionConfiguration.default
            konfig.timeoutIntervalForRequest = 15
            konfig.timeoutIntervalForResource = 15
            konfig.protocolClasses = [ProtokolSkenarioUji.self] + (konfig.protocolClasses ?? [])
            return URLSession(configuration: konfig)
        }
        #endif
        return nil
    }
}
