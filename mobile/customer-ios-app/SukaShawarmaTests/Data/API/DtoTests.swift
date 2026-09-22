import Foundation
import Testing
@testable import SukaShawarma

/// Menjaga kontrak JSON dengan gateway (tak ada padanan langsung di Android;
/// di sana kontrak ini tersirat dari anotasi kotlinx.serialization).
struct DtoTests {
    private func urai<T: Decodable>(_ tipe: T.Type, _ json: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    private func sandi(_ nilai: some Encodable) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(nilai)) as! [String: Any]
    }

    @Test func posOrderNumberAngkaDanFieldTakDikenalDiabaikan() throws {
        let o = try urai(OrderDetailDto.self, #"""
        {"id":"x","status":"paid","total_amount":58000,"pos_order_number":12,
         "created_at":"2026-09-07T10:08:34.123577+07:00","pickup_code":"ABC","baru":1}
        """#)
        #expect(o.posOrderNumber == 12)
        #expect(o.totalAmount == 58000)
        #expect(o.expiresAt == nil)
    }

    @Test func defaultBannerSplashNotifikasi() throws {
        let b = try urai(BannersResponse.self, #"{"popup":{"id":"p","judul":"Promo"}}"#)
        #expect(b.carousel.isEmpty)
        #expect(b.popup?.aksi == "tidak_ada")

        #expect(try urai(SplashDto.self, "{}").durasiMs == 3000)

        let n = try urai(NotificationListResponse.self, "{}")
        #expect(n.notifications.isEmpty && n.unreadCount == 0)

        let p = try urai(NotificationPreferencesResponse.self, "{}")
        #expect(p.notifyOrderStatus && p.notifyPromotions)
    }

    @Test func katalogTanpaNamaKategoriTetapTerurai() throws {
        let k = try urai(CatalogResponse.self, #"{"items":[{"id":"m","name":"Shawarma","price":25000,"is_available":true}]}"#)
        #expect(k.items.first?.categoryName == nil)
    }

    @Test func checkoutValidateDiscountAmountCamelCase() throws {
        let r = try urai(CheckoutValidateResponse.self, #"{"ok":true,"subtotal":10,"discountAmount":2,"total":8}"#)
        #expect(r.discountAmount == 2)
    }

    @Test func fieldNilTidakDikirim() throws {
        let item = try sandi(CartItemPayload(menuItemId: "m", name: "S", unitPrice: 25000, quantity: 1))
        #expect(item["note"] == nil)
        #expect(item["menu_item_id"] as? String == "m")

        let order = try sandi(CreateOrderRequest(clientOrderId: "c", outletId: "o", items: []))
        #expect(order["customer_phone"] == nil)

        let profil = try sandi(UpdateProfileRequest(name: nil, phone: ""))
        #expect(profil["name"] == nil)
        #expect(profil["phone"] as? String == "")
    }

    @Test func markAllFalseTidakDikirimSepertiAndroid() throws {
        #expect(try sandi(MarkNotificationReadRequest(notificationId: "n")).keys.sorted() == ["notification_id"])
        #expect(try sandi(MarkNotificationReadRequest(markAll: true))["mark_all"] as? Bool == true)
    }
}
