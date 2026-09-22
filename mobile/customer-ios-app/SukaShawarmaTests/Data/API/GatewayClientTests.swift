import Foundation
import Testing
@testable import SukaShawarma

/// Menguji aturan keamanan header yang di Android hanya dijaga komentar:
/// Authorization HANYA ke endpoint ber-otorisasi, dan hanya bila token ada.
@Suite(.serialized)
struct GatewayClientTests {
    private func klien(token: String?) -> GatewayClient {
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [ProtokolPalsu.self]
        return GatewayClient(baseURL: URL(string: "https://gateway.uji")!,
                             token: { token }, session: URLSession(configuration: konfig))
    }

    @Test func endpointPublikTakPernahMembawaToken() async {
        ProtokolPalsu.pasang(status: 200, body: #"{"items":[]}"#)
        _ = await klien(token: "rahasia").catalog(outletId: "o 1")
        let req = ProtokolPalsu.terakhir!
        #expect(req.value(forHTTPHeaderField: "Authorization") == nil)
        #expect(req.url?.absoluteString == "https://gateway.uji/api/v1/catalog?outlet_id=o%201")
    }

    @Test func endpointBerotorisasiMembawaTokenBilaAda() async {
        ProtokolPalsu.pasang(status: 200, body: #"{"orders":[]}"#)
        _ = await klien(token: "rahasia").ordersList()
        #expect(ProtokolPalsu.terakhir?.value(forHTTPHeaderField: "Authorization") == "Bearer rahasia")
    }

    @Test func tanpaTokenTakAdaHeaderBearerNull() async {
        ProtokolPalsu.pasang(status: 401, body: #"{"error":"Sesi tidak sah"}"#)
        let hasil = await klien(token: nil).ordersList()
        #expect(ProtokolPalsu.terakhir?.value(forHTTPHeaderField: "Authorization") == nil)
        guard case .gagal(.sesiTidakSah) = hasil else { Issue.record("harus sesiTidakSah"); return }
    }

    @Test func balasanSuksesTerurai() async {
        ProtokolPalsu.pasang(status: 200, body: #"{"outlets":[{"id":"o","name":"Empang","is_active":true}]}"#)
        guard case .sukses(let r) = await klien(token: nil).outlets() else { Issue.record("harus sukses"); return }
        #expect(r.outlets.first?.name == "Empang")
    }

    @Test func galatBisnisDipetakan() async {
        ProtokolPalsu.pasang(status: 409, body: #"{"error":"pesanan_kadaluarsa","pesan":"Kedaluwarsa"}"#)
        let hasil = await klien(token: "t").createOrder(CreateOrderRequest(clientOrderId: "c", outletId: "o", items: []))
        guard case .gagal(.kode("pesanan_kadaluarsa", "Kedaluwarsa")) = hasil else { Issue.record("harus kode"); return }
        #expect(ProtokolPalsu.terakhir?.httpMethod == "POST")
    }

    @Test func gambarSplashHanyaHttpsGambarTanpaToken() async {
        let k = klien(token: "rahasia")
        #expect(await k.unduhGambarSplash(url: "http://x.id/a.jpg") == nil)

        ProtokolPalsu.pasang(status: 200, body: "<html/>", tipe: "text/html")
        #expect(await k.unduhGambarSplash(url: "https://x.id/a.jpg") == nil)

        ProtokolPalsu.pasang(status: 200, body: "JPEGDATA", tipe: "image/jpeg")
        #expect(await k.unduhGambarSplash(url: "https://x.id/a.jpg") == Data("JPEGDATA".utf8))
        #expect(ProtokolPalsu.terakhir?.value(forHTTPHeaderField: "Authorization") == nil)
    }
}

/// URLProtocol palsu: merekam permintaan terakhir dan membalas isi yang dipasang.
final class ProtokolPalsu: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var terakhir: URLRequest?
    nonisolated(unsafe) static var balasan: (Int, Data, String) = (200, Data(), "application/json")

    static func pasang(status: Int, body: String, tipe: String = "application/json") {
        balasan = (status, Data(body.utf8), tipe)
        terakhir = nil
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.terakhir = request
        let (status, data, tipe) = Self.balasan
        let resp = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil,
                                   headerFields: ["Content-Type": tipe])!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
