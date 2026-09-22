#if DEBUG
import Foundation

/// Skenario uji untuk `SukaShawarmaUITests` — HANYA di build Debug, tak pernah
/// ikut rilis. Diaktifkan lewat argumen peluncuran `-skenarioUji <nama>`.
///
/// Gunanya: layar yang butuh sesi (checkout) bisa diuji sebelum login Google
/// iOS tersedia. Hanya `POST /api/v1/checkout/validate` yang dipalsukan; semua
/// endpoint lain tetap ke gateway produksi sungguhan.
///
/// Setiap skenario memakai **sesi palsu di item Keychain terpisah**
/// (`…session.skenario-uji`), jadi sesi sungguhan pelanggan tak tersentuh dan
/// sesi palsu tak pernah bocor ke peluncuran normal.
///
/// Endpoint yang dipalsukan: `POST /api/v1/checkout/validate`,
/// `GET|PATCH /api/v1/customer/profile`, `POST /api/v1/orders`,
/// `GET /api/v1/orders/{id}`, `GET /api/v1/orders/list`, `GET|POST
/// /api/v1/notifications`, `PATCH /api/v1/customer/notification-preferences`
/// — jadi TIDAK ADA pesanan/tagihan sungguhan yang
/// terbit dari skenario mana pun. Pesanan palsu berstatus `menunggu_bayar`
/// untuk dua penanyaan pertama, lalu `dibayar` dengan nomor antrean 42.
///
/// - `checkout-ok`       : validasi lolos, subtotal = jumlah harga keranjang.
/// - `checkout-masalah`  : panggilan PERTAMA menolak (harga item pertama naik
///                         Rp2.000), panggilan berikutnya lolos — menguji alur
///                         "Pakai harga baru" → validasi ulang.
enum SkenarioUji {
    static var nama: String? { UserDefaults.standard.string(forKey: "skenarioUji") }
    static var aktif: Bool { nama != nil }

    /// Sesi palsu yang disegarkan setiap peluncuran skenario.
    static func siapkanSesi() -> SessionStore {
        let s = SessionStore(layanan: "com.sukashawarma.customer.session.skenario-uji")
        s.simpan(token: "token-uji", expiresAt: "2099-01-01T00:00:00.000Z",
                 nama: "Pelanggan Uji", email: "uji@contoh.id", telepon: "6281234567890")
        return s
    }
}

final class ProtokolSkenarioUji: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) private static var jumlahPanggilan = 0
    nonisolated(unsafe) private static var profil: [String: Any] =
        ["id": "c-uji", "name": "Pelanggan Uji", "email": "uji@contoh.id", "phone": "6281234567890"]

    nonisolated(unsafe) private static var tanyaStatus = 0
    private static let qrContoh = "00020101021226670016COM.NOBUBANK.WWW01189360050300000898240214SUKA0000000UJI0303UMI51440014ID.CO.QRIS.WWW0215ID10200000000010303UMI5204581253033605802ID5920SUKA SHAWARMA UJI6005BOGOR61051612362070703A016304B1C2"

    override class func canInit(with request: URLRequest) -> Bool {
        let jalur = request.url?.path() ?? ""
        return ["/api/v1/checkout/validate", "/api/v1/customer/profile", "/api/v1/orders",
                "/api/v1/notifications", "/api/v1/customer/notification-preferences"].contains(jalur)
            || jalur.hasPrefix("/api/v1/orders/")
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let jalur = request.url?.path() ?? ""
        if jalur == "/api/v1/orders" {
            Self.tanyaStatus = 0
            let items = bacaJson()["items"] as? [[String: Any]] ?? []
            let total = items.reduce(0.0) { $0 + (($1["unit_price"] as? Double) ?? 0) * Double(($1["quantity"] as? Int) ?? 0) }
            let batas = ISO8601DateFormatter().string(from: Date().addingTimeInterval(15 * 60))
            balas(["order_id": "pesanan-uji", "total_amount": total, "expires_at": batas, "qr_string": Self.qrContoh])
            return
        }
        if jalur == "/api/v1/orders/list" {
            balas(["orders": Self.riwayat])
            return
        }
        if let lama = Self.riwayat.first(where: { jalur == "/api/v1/orders/\($0["id"] as! String)" }) {
            balas(lama)
            return
        }
        if jalur == "/api/v1/notifications" {
            if request.httpMethod == "POST" { balas([:]); return }
            balas(["notifications": [
                ["id": "n1", "order_id": "uji-43", "type": "order_status", "title": "Pesanan Sedang Dibuat",
                 "body": "Pesanan #43 sedang disiapkan dapur.", "is_read": false, "created_at": Self.jamLalu(0.2)],
                ["id": "n2", "order_id": "uji-41", "type": "reminder", "title": "Siap Diambil",
                 "body": "Pesanan #41 siap diambil di kasir.", "is_read": true, "created_at": Self.jamLalu(3)],
                ["id": "n3", "type": "promo", "title": "Promo Akhir Pekan",
                 "body": "Contoh promo untuk uji — bukan penawaran sungguhan.", "is_read": false, "created_at": Self.jamLalu(26)],
            ], "unread_count": 2])
            return
        }
        if jalur == "/api/v1/customer/notification-preferences" { balas([:]); return }
        if jalur.hasPrefix("/api/v1/orders/") {
            Self.tanyaStatus += 1
            let dibayar = Self.tanyaStatus > 2
            balas(["id": "pesanan-uji", "status": dibayar ? "dibayar" : "menunggu_bayar", "total_amount": 0,
                   "pos_order_number": dibayar ? 42 : NSNull(), "outlet_name": "outlet tes",
                   "created_at": ISO8601DateFormatter().string(from: Date()),
                   "qr_string": Self.qrContoh])
            return
        }
        if jalur == "/api/v1/customer/profile" {
            if request.httpMethod == "PATCH" {
                let ubah = bacaJson()
                if let n = ubah["name"] as? String { Self.profil["name"] = n }
                // Gateway menormalkan nomor; di sini cukup ditiru untuk bentuk 08xxx.
                if let p = ubah["phone"] as? String {
                    let angka = p.filter(\.isNumber)
                    Self.profil["phone"] = angka.isEmpty ? NSNull() : (angka.hasPrefix("0") ? "62" + angka.dropFirst() : angka)
                }
            }
            balas(["customer": Self.profil])
            return
        }

        Self.jumlahPanggilan += 1
        let items = bacaJson()["items"] as? [[String: Any]] ?? []
        let subtotal = items.reduce(0.0) { $0 + (($1["unit_price"] as? Double) ?? 0) * Double(($1["quantity"] as? Int) ?? 0) }
        var balasan: [String: Any] = ["ok": true, "subtotal": subtotal, "discountAmount": 0, "total": subtotal]

        if SkenarioUji.nama == "checkout-masalah", Self.jumlahPanggilan == 1, let pertama = items.first {
            balasan = ["ok": false, "alasan": "keranjang_berubah",
                       "masalah": [["menu_item_id": pertama["menu_item_id"] ?? "", "name": pertama["name"] ?? "",
                                    "jenis": "harga_berubah",
                                    "harga_baru": ((pertama["unit_price"] as? Double) ?? 0) + 2000]]]
        }

        balas(balasan)
    }

    private func balas(_ balasan: [String: Any]) {
        let data = (try? JSONSerialization.data(withJSONObject: balasan)) ?? Data()
        let resp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil,
                                   headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func jamLalu(_ jam: Double) -> String {
        ISO8601DateFormatter().string(from: Date().addingTimeInterval(-jam * 3600))
    }

    /// Riwayat palsu: satu pesanan untuk tiap keadaan yang bisa ditampilkan.
    private static var riwayat: [[String: Any]] {
        [("uji-43", "preparing", 43, 0.2), ("uji-41", "ready", 41, 3.0),
         ("uji-40", "completed", 40, 26.0), ("uji-39", "cancelled", 39, 50.0)].map { id, dapur, nomor, jam in
            ["id": id, "status": dapur == "cancelled" ? "dibayar" : "dibayar", "status_dapur": dapur,
             "total_amount": 58000, "pos_order_number": nomor, "outlet_name": "outlet tes",
             "created_at": jamLalu(jam)]
        }
    }

    /// Di dalam URLProtocol, body permintaan hanya tersedia sebagai stream.
    private func bacaJson() -> [String: Any] {
        guard let stream = request.httpBodyStream else { return [:] }
        stream.open(); defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let n = stream.read(&buffer, maxLength: buffer.count)
            if n <= 0 { break }
            data.append(buffer, count: n)
        }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }
}
#endif
