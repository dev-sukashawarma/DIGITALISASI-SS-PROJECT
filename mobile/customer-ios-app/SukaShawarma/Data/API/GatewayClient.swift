import Foundation

private let batasWaktuDetik: TimeInterval = 15

/// Batas ukuran gambar splash yang mau disimpan. Admin sudah mengecilkannya saat unggah.
let batasGambarSplashByte = 5 * 1024 * 1024

/// Padanan `data/api/GatewayClient.kt`. Bicara HANYA ke Retail Gateway — tidak
/// pernah ke Supabase langsung, tidak ada service-role key di aplikasi ini.
///
/// Menyisipkan `Authorization: Bearer <token>` untuk semua endpoint KECUALI
/// `auth/google`, `catalog`, `outlets`, `banners`, dan `splash`.
final class GatewayClient: Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let token: @Sendable () -> String?

    init(baseURL: URL, token: @escaping @Sendable () -> String?, session: URLSession? = nil) {
        self.baseURL = baseURL
        self.token = token
        if let session {
            self.session = session
        } else {
            let konfig = URLSessionConfiguration.default
            konfig.timeoutIntervalForRequest = batasWaktuDetik
            konfig.timeoutIntervalForResource = batasWaktuDetik
            self.session = URLSession(configuration: konfig)
        }
    }

    // MARK: Endpoint publik (tanpa otorisasi)

    func loginGoogle(idToken: String) async -> GatewayResult<AuthResponse> {
        await kirim("api/v1/auth/google", metode: "POST", body: GoogleAuthRequest(idToken: idToken))
    }

    func loginApple(_ request: AppleAuthRequest) async -> GatewayResult<AuthResponse> {
        await kirim("api/v1/auth/apple", metode: "POST", body: request)
    }

    func outlets() async -> GatewayResult<OutletsResponse> {
        await kirim("api/v1/outlets")
    }

    func catalog(outletId: String) async -> GatewayResult<CatalogResponse> {
        await kirim("api/v1/catalog", query: ["outlet_id": outletId])
    }

    func banners() async -> GatewayResult<BannersResponse> {
        await kirim("api/v1/banners")
    }

    func splash() async -> GatewayResult<SplashDto> {
        await kirim("api/v1/splash")
    }

    /// Mengunduh gambar splash. Nil untuk apa pun yang bukan gambar sungguhan:
    /// status gagal, tipe bukan `image/`, berkas kosong, atau melebihi
    /// [batasGambarSplashByte]. TANPA header otorisasi: token sesi tak boleh
    /// ikut terkirim ke alamat yang ditentukan isi basis data.
    func unduhGambarSplash(url: String) async -> Data? {
        guard url.hasPrefix("https://"), let alamat = URL(string: url) else { return nil }
        do {
            let (data, response) = try await session.data(from: alamat)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  (http.value(forHTTPHeaderField: "Content-Type") ?? "").hasPrefix("image/"),
                  !data.isEmpty, data.count <= batasGambarSplashByte
            else { return nil }
            return data
        } catch {
            return nil
        }
    }

    // MARK: Endpoint ber-otorisasi

    func checkoutValidate(_ request: CheckoutValidateRequest) async -> GatewayResult<CheckoutValidateResponse> {
        await kirim("api/v1/checkout/validate", metode: "POST", body: request, otorisasi: true)
    }

    func createOrder(_ request: CreateOrderRequest) async -> GatewayResult<CreateOrderResponse> {
        await kirim("api/v1/orders", metode: "POST", body: request, otorisasi: true)
    }

    func orderDetail(orderId: String) async -> GatewayResult<OrderDetailDto> {
        await kirim("api/v1/orders/\(orderId)", otorisasi: true)
    }

    func ordersList() async -> GatewayResult<OrdersListResponse> {
        await kirim("api/v1/orders/list", otorisasi: true)
    }

    func notifications(category: String? = nil) async -> GatewayResult<NotificationListResponse> {
        let query = (category != nil && category != "all") ? ["category": category!] : [:]
        return await kirim("api/v1/notifications", query: query, otorisasi: true)
    }

    func markNotificationRead(notificationId: String? = nil, markAll: Bool = false) async -> GatewayResult<Void> {
        await kirimTanpaIsi("api/v1/notifications", metode: "POST",
                            body: MarkNotificationReadRequest(notificationId: notificationId, markAll: markAll))
    }

    func notificationPreferences() async -> GatewayResult<NotificationPreferencesResponse> {
        await kirim("api/v1/customer/notification-preferences", otorisasi: true)
    }

    func updateNotificationPreferences(_ request: UpdateNotificationPreferencesRequest) async -> GatewayResult<Void> {
        await kirimTanpaIsi("api/v1/customer/notification-preferences", metode: "PATCH", body: request)
    }

    func profile() async -> GatewayResult<ProfileResponse> {
        await kirim("api/v1/customer/profile", otorisasi: true)
    }

    func updateProfile(_ request: UpdateProfileRequest) async -> GatewayResult<ProfileResponse> {
        await kirim("api/v1/customer/profile", metode: "PATCH", body: request, otorisasi: true)
    }

    // MARK: Inti

    private func buatPermintaan(_ jalur: String, metode: String, query: [String: String],
                                body: (any Encodable)?, otorisasi: Bool) throws -> URLRequest {
        var komponen = URLComponents(url: baseURL.appending(path: jalur), resolvingAgainstBaseURL: false)!
        if !query.isEmpty {
            komponen.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var req = URLRequest(url: komponen.url!)
        req.httpMethod = metode
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        // Sisipkan HANYA bila ada token — tanpa ini permintaan sebelum login
        // mengirim literal "Bearer null" (lihat GatewayClient.kt).
        if otorisasi, let t = token() {
            req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private func jalankan(_ req: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (data, http)
    }

    private func kirim<T: Decodable & Sendable>(
        _ jalur: String, metode: String = "GET", query: [String: String] = [:],
        body: (any Encodable)? = nil, otorisasi: Bool = false
    ) async -> GatewayResult<T> {
        do {
            let (data, http) = try await jalankan(
                buatPermintaan(jalur, metode: metode, query: query, body: body, otorisasi: otorisasi))
            guard (200..<300).contains(http.statusCode) else {
                return .gagal(petakanGalat(status: http.statusCode, body: String(data: data, encoding: .utf8)))
            }
            // Catatan paritas: seperti Android, kegagalan mengurai body sukses
            // jatuh ke `.jaringan` karena dilempar di dalam blok yang sama.
            return .sukses(try JSONDecoder().decode(T.self, from: data))
        } catch {
            return .gagal(.jaringan(error))
        }
    }

    private func kirimTanpaIsi(_ jalur: String, metode: String, body: any Encodable) async -> GatewayResult<Void> {
        do {
            let (data, http) = try await jalankan(
                buatPermintaan(jalur, metode: metode, query: [:], body: body, otorisasi: true))
            guard (200..<300).contains(http.statusCode) else {
                return .gagal(petakanGalat(status: http.statusCode, body: String(data: data, encoding: .utf8)))
            }
            return .sukses(())
        } catch {
            return .gagal(.jaringan(error))
        }
    }
}
