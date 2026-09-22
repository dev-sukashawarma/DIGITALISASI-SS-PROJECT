import Foundation

// Padanan `data/api/Dto.kt`. Bentuk balasan gateway dicerminkan PERSIS dari
// apps/retail-gateway/src/app/api/v1/**/route.ts — jangan mengarang nama
// field. `pickup_code` sengaja TIDAK ADA: pesanan memakai `pos_order_number`.
//
// Aturan penyandian yang meniru kotlinx.serialization di Android:
//   * field tak dikenal diabaikan (bawaan JSONDecoder);
//   * field opsional bernilai nil TIDAK dikirim (bawaan encodeIfPresent) —
//     setara `encodeDefaults = false` untuk field ber-default null;
//   * field dengan default non-null (mis. `aksi = "tidak_ada"`) diurai lewat
//     `decodeIfPresent ?? default`, supaya gateway lama tetap terbaca.

struct GoogleAuthRequest: Encodable, Sendable {
    let idToken: String
    enum CodingKeys: String, CodingKey { case idToken = "id_token" }
}

/// `POST /api/v1/auth/apple` — ⚠️ ENDPOINT INI BELUM ADA di Retail Gateway.
/// Usulan kontrak (RANCANGAN.md §5 butir 2): gateway memanggil Supabase
/// `signInWithIdToken({ provider: 'apple', token: id_token, nonce })`, lalu
/// membalas `AuthResponse` yang SAMA dengan `auth/google`. `name` hanya ada pada
/// masuk pertama (Apple tak pernah mengirimnya lagi) — gateway mengisinya bila
/// nama pelanggan masih kosong, sama seperti aturan nama Google.
struct AppleAuthRequest: Encodable, Sendable {
    let idToken: String
    let nonce: String
    var name: String?
    enum CodingKeys: String, CodingKey {
        case nonce, name
        case idToken = "id_token"
    }
}

struct CustomerDto: Codable, Sendable, Equatable {
    let id: String
    var name: String?
    var email: String?
    var phone: String?
}

struct AuthResponse: Decodable, Sendable {
    let token: String
    let expiresAt: String
    let customer: CustomerDto
    enum CodingKeys: String, CodingKey {
        case token, customer
        case expiresAt = "expires_at"
    }
}

struct OutletDto: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    var address: String?
    var lat: Double?
    var lng: Double?
    let isActive: Bool
    enum CodingKeys: String, CodingKey {
        case id, name, address, lat, lng
        case isActive = "is_active"
    }
}

struct OutletsResponse: Decodable, Sendable {
    let outlets: [OutletDto]
}

struct MenuItemDto: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    var description: String?
    let price: Double
    var imageUrl: String?
    let isAvailable: Bool
    var categoryId: String?
    var sortOrder: Int?
    // Nama kategori boleh absen (gateway lama): judul kelompok hilang, menu tetap tampil.
    var categoryName: String?
    var categorySortOrder: Int?
    enum CodingKeys: String, CodingKey {
        case id, name, description, price
        case imageUrl = "image_url"
        case isAvailable = "is_available"
        case categoryId = "category_id"
        case sortOrder = "sort_order"
        case categoryName = "category_name"
        case categorySortOrder = "category_sort_order"
    }
}

struct CatalogResponse: Decodable, Sendable {
    let items: [MenuItemDto]
}

/// `urutan` sengaja tidak dideklarasikan: urutan carousel = urutan array JSON.
struct BannerDto: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    var badge: String?
    let judul: String
    var subjudul: String?
    var teksTombol: String?
    var gambarUrl: String?
    var aksi: String = "tidak_ada"
    var targetMenuItemId: String?

    enum CodingKeys: String, CodingKey {
        case id, badge, judul, subjudul, aksi
        case teksTombol = "teks_tombol"
        case gambarUrl = "gambar_url"
        case targetMenuItemId = "target_menu_item_id"
    }

    init(id: String, badge: String? = nil, judul: String, subjudul: String? = nil,
         teksTombol: String? = nil, gambarUrl: String? = nil,
         aksi: String = "tidak_ada", targetMenuItemId: String? = nil) {
        self.id = id; self.badge = badge; self.judul = judul; self.subjudul = subjudul
        self.teksTombol = teksTombol; self.gambarUrl = gambarUrl
        self.aksi = aksi; self.targetMenuItemId = targetMenuItemId
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        badge = try c.decodeIfPresent(String.self, forKey: .badge)
        judul = try c.decode(String.self, forKey: .judul)
        subjudul = try c.decodeIfPresent(String.self, forKey: .subjudul)
        teksTombol = try c.decodeIfPresent(String.self, forKey: .teksTombol)
        gambarUrl = try c.decodeIfPresent(String.self, forKey: .gambarUrl)
        aksi = try c.decodeIfPresent(String.self, forKey: .aksi) ?? "tidak_ada"
        targetMenuItemId = try c.decodeIfPresent(String.self, forKey: .targetMenuItemId)
    }
}

/// `GET /api/v1/splash`. `gambarUrl` nil = pakai gambar bawaan aplikasi.
struct SplashDto: Decodable, Sendable, Equatable {
    var gambarUrl: String?
    var durasiMs: Int = 3000

    enum CodingKeys: String, CodingKey {
        case gambarUrl = "gambar_url"
        case durasiMs = "durasi_ms"
    }

    init(gambarUrl: String? = nil, durasiMs: Int = 3000) {
        self.gambarUrl = gambarUrl; self.durasiMs = durasiMs
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        gambarUrl = try c.decodeIfPresent(String.self, forKey: .gambarUrl)
        durasiMs = try c.decodeIfPresent(Int.self, forKey: .durasiMs) ?? 3000
    }
}

struct BannersResponse: Decodable, Sendable, Equatable {
    var carousel: [BannerDto] = []
    var popup: BannerDto?

    init(carousel: [BannerDto] = [], popup: BannerDto? = nil) {
        self.carousel = carousel; self.popup = popup
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        carousel = try c.decodeIfPresent([BannerDto].self, forKey: .carousel) ?? []
        popup = try c.decodeIfPresent(BannerDto.self, forKey: .popup)
    }

    enum CodingKeys: String, CodingKey { case carousel, popup }
}

struct CartItemPayload: Encodable, Sendable, Equatable {
    let menuItemId: String
    let name: String
    let unitPrice: Double
    let quantity: Int
    var note: String?
    enum CodingKeys: String, CodingKey {
        case name, quantity, note
        case menuItemId = "menu_item_id"
        case unitPrice = "unit_price"
    }
}

struct CheckoutValidateRequest: Encodable, Sendable {
    let outletId: String
    let items: [CartItemPayload]
    enum CodingKeys: String, CodingKey {
        case items
        case outletId = "outlet_id"
    }
}

struct CartProblemDto: Decodable, Sendable, Equatable {
    let menuItemId: String
    let name: String
    let jenis: String
    var hargaBaru: Double?
    enum CodingKeys: String, CodingKey {
        case name, jenis
        case menuItemId = "menu_item_id"
        case hargaBaru = "harga_baru"
    }
}

/// `discountAmount` sengaja camelCase — checkout/validate memang tidak
/// konsisten dengan endpoint lain. Dicerminkan apa adanya.
///
/// PENTING: penolakan bisnis datang sebagai HTTP 200 dengan `ok == false`.
struct CheckoutValidateResponse: Decodable, Sendable, Equatable {
    let ok: Bool
    var subtotal: Double?
    var discountAmount: Double?
    var total: Double?
    var alasan: String?
    var pesan: String?
    var masalah: [CartProblemDto]?
}

struct CreateOrderRequest: Encodable, Sendable {
    let clientOrderId: String
    let outletId: String
    let items: [CartItemPayload]
    var customerPhone: String?
    enum CodingKeys: String, CodingKey {
        case items
        case clientOrderId = "client_order_id"
        case outletId = "outlet_id"
        case customerPhone = "customer_phone"
    }
}

struct CreateOrderResponse: Decodable, Sendable, Equatable {
    let orderId: String
    var paymentUrl: String?
    let totalAmount: Double
    let expiresAt: String
    /// Teks mentah QRIS; aplikasi menggambar kodenya sendiri. `paymentUrl`
    /// hanya terisi bila gateway jatuh ke jalur Invoice.
    var qrString: String?
    var duplicate: Bool?
    enum CodingKeys: String, CodingKey {
        case duplicate
        case orderId = "order_id"
        case paymentUrl = "payment_url"
        case totalAmount = "total_amount"
        case expiresAt = "expires_at"
        case qrString = "qr_string"
    }
}

struct OrderDetailDto: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let status: String
    var statusDapur: String?
    let totalAmount: Double
    /// `Int`, bukan `String` — kolom `pos_order_number int`. Salah tipe di
    /// sini membuat layar status & riwayat SELALU gagal (lihat Dto.kt).
    var posOrderNumber: Int?
    var outletName: String?
    let createdAt: String
    /// Nil = tidak diketahui (gateway lama). Jangan buang percobaan atas dasar tebakan.
    var expiresAt: String?
    var paymentUrl: String?
    var qrString: String?
    enum CodingKeys: String, CodingKey {
        case id, status
        case statusDapur = "status_dapur"
        case totalAmount = "total_amount"
        case posOrderNumber = "pos_order_number"
        case outletName = "outlet_name"
        case createdAt = "created_at"
        case expiresAt = "expires_at"
        case paymentUrl = "payment_url"
        case qrString = "qr_string"
    }
}

struct OrdersListResponse: Decodable, Sendable {
    let orders: [OrderDetailDto]
}

struct NotificationDto: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    var customerId: String?
    var orderId: String?
    let type: String
    let title: String
    let body: String
    var isRead: Bool = false
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, title, body
        case customerId = "customer_id"
        case orderId = "order_id"
        case isRead = "is_read"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        customerId = try c.decodeIfPresent(String.self, forKey: .customerId)
        orderId = try c.decodeIfPresent(String.self, forKey: .orderId)
        type = try c.decode(String.self, forKey: .type)
        title = try c.decode(String.self, forKey: .title)
        body = try c.decode(String.self, forKey: .body)
        isRead = try c.decodeIfPresent(Bool.self, forKey: .isRead) ?? false
        createdAt = try c.decode(String.self, forKey: .createdAt)
    }

    init(id: String, customerId: String? = nil, orderId: String?, type: String, title: String, body: String,
         isRead: Bool = false, createdAt: String) {
        self.id = id; self.customerId = customerId; self.orderId = orderId; self.type = type
        self.title = title; self.body = body; self.isRead = isRead; self.createdAt = createdAt
    }
}

struct NotificationListResponse: Decodable, Sendable, Equatable {
    var notifications: [NotificationDto] = []
    var unreadCount: Int = 0

    enum CodingKeys: String, CodingKey {
        case notifications
        case unreadCount = "unread_count"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        notifications = try c.decodeIfPresent([NotificationDto].self, forKey: .notifications) ?? []
        unreadCount = try c.decodeIfPresent(Int.self, forKey: .unreadCount) ?? 0
    }
}

/// Android tidak mengirim `mark_all` saat bernilai false (default tak
/// disandikan); di sini direpresentasikan sebagai nil agar body-nya identik.
struct MarkNotificationReadRequest: Encodable, Sendable {
    var notificationId: String?
    var markAll: Bool?

    init(notificationId: String? = nil, markAll: Bool = false) {
        self.notificationId = notificationId
        self.markAll = markAll ? true : nil
    }

    enum CodingKeys: String, CodingKey {
        case notificationId = "notification_id"
        case markAll = "mark_all"
    }
}

struct NotificationPreferencesResponse: Decodable, Sendable, Equatable {
    var notifyOrderStatus: Bool = true
    var notifyPromotions: Bool = true

    enum CodingKeys: String, CodingKey {
        case notifyOrderStatus = "notify_order_status"
        case notifyPromotions = "notify_promotions"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        notifyOrderStatus = try c.decodeIfPresent(Bool.self, forKey: .notifyOrderStatus) ?? true
        notifyPromotions = try c.decodeIfPresent(Bool.self, forKey: .notifyPromotions) ?? true
    }
}

struct UpdateNotificationPreferencesRequest: Encodable, Sendable {
    var notifyOrderStatus: Bool?
    var notifyPromotions: Bool?
    enum CodingKeys: String, CodingKey {
        case notifyOrderStatus = "notify_order_status"
        case notifyPromotions = "notify_promotions"
    }
}

struct ProfileResponse: Decodable, Sendable {
    let customer: CustomerDto
}

/// Field nil = tidak diubah. `phone` string kosong = hapus nomor.
struct UpdateProfileRequest: Encodable, Sendable {
    var name: String?
    var phone: String?
}

// `FcmTokenRequest` sengaja belum diporting: Android pun tidak pernah
// memanggil `registerFcmToken`. Push (APNs) ditunda — lihat RANCANGAN.md §4.
