import Foundation

/// Padanan `data/Repository.kt`: satu-satunya pintu data aplikasi. Semua layar
/// lewat sini, dan sini hanya bicara ke [GatewayClient].
///
/// Membungkus [GatewayResult] apa adanya, TIDAK menelan galat jadi daftar
/// kosong: layar wajib bisa membedakan "menu memang belum ada" dari "gagal
/// memuat menu".
final class Repository: Sendable {
    private let gateway: GatewayClient

    init(gateway: GatewayClient) {
        self.gateway = gateway
    }

    /// Menukar ID token Google dengan sesi gateway. Aplikasi tak pernah
    /// memvalidasi token sendiri dan tak pernah menyentuh Supabase.
    func loginGoogle(idToken: String) async -> GatewayResult<AuthResponse> {
        await gateway.loginGoogle(idToken: idToken)
    }

    /// Menukar ID token Apple (+ nonce mentah) dengan sesi gateway.
    func loginApple(idToken: String, nonce: String, nama: String?) async -> GatewayResult<AuthResponse> {
        await gateway.loginApple(AppleAuthRequest(idToken: idToken, nonce: nonce, name: nama))
    }

    func outlets() async -> GatewayResult<[OutletDto]> {
        await gateway.outlets().peta(\.outlets)
    }

    func banners() async -> GatewayResult<BannersResponse> { await gateway.banners() }

    func splash() async -> GatewayResult<SplashDto> { await gateway.splash() }

    func unduhGambarSplash(url: String) async -> Data? { await gateway.unduhGambarSplash(url: url) }

    func katalog(outletId: String) async -> GatewayResult<[MenuItemDto]> {
        await gateway.catalog(outletId: outletId).peta(\.items)
    }

    /// Validasi pra-bayar. PENTING: penolakan bisnis datang sebagai HTTP 200
    /// dengan `ok == false`. `.sukses` di sini BUKAN lampu hijau — periksa `ok`.
    func validasiCheckout(outletId: String, items: [CartItemPayload]) async -> GatewayResult<CheckoutValidateResponse> {
        await gateway.checkoutValidate(CheckoutValidateRequest(outletId: outletId, items: items))
    }

    /// `clientOrderId` = kunci idempotensi. Pemanggil WAJIB memakai ulang id
    /// yang sama untuk percobaan ulang (lihat `Idempotensi.kt`, Fase 4).
    func buatPesanan(clientOrderId: String, outletId: String, items: [CartItemPayload],
                     telepon: String? = nil) async -> GatewayResult<CreateOrderResponse> {
        await gateway.createOrder(CreateOrderRequest(clientOrderId: clientOrderId, outletId: outletId,
                                                     items: items, customerPhone: telepon))
    }

    func statusPesanan(orderId: String) async -> GatewayResult<OrderDetailDto> {
        await gateway.orderDetail(orderId: orderId)
    }

    func riwayat() async -> GatewayResult<[OrderDetailDto]> {
        await gateway.ordersList().peta(\.orders)
    }

    func ambilNotifikasi(kategori: String? = nil) async -> GatewayResult<NotificationListResponse> {
        await gateway.notifications(category: kategori)
    }

    func tandaiNotifikasiDibaca(notificationId: String? = nil, tandaiSemua: Bool = false) async -> GatewayResult<Void> {
        await gateway.markNotificationRead(notificationId: notificationId, markAll: tandaiSemua)
    }

    func ambilPreferensiNotifikasi() async -> GatewayResult<NotificationPreferencesResponse> {
        await gateway.notificationPreferences()
    }

    func simpanPreferensiNotifikasi(pesanan: Bool? = nil, promo: Bool? = nil) async -> GatewayResult<Void> {
        await gateway.updateNotificationPreferences(
            UpdateNotificationPreferencesRequest(notifyOrderStatus: pesanan, notifyPromotions: promo))
    }

    func profil() async -> GatewayResult<CustomerDto> {
        await gateway.profile().peta(\.customer)
    }

    func simpanProfil(nama: String?, telepon: String?) async -> GatewayResult<CustomerDto> {
        await gateway.updateProfile(UpdateProfileRequest(name: nama, phone: telepon)).peta(\.customer)
    }
}
