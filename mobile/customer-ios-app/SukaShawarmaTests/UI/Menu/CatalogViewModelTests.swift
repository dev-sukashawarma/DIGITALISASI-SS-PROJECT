import Foundation
import Testing
@testable import SukaShawarma

/// Aturan pemilihan outlet di `CatalogViewModel.muat()` — di Android tak diuji,
/// padahal di sinilah keranjang bisa dikosongkan dan outlet dicabut dideteksi.
@MainActor
@Suite(.serialized)
struct CatalogViewModelTests {
    private let outletA = #"{"id":"A","name":"Empang","is_active":true}"#
    private let outletB = #"{"id":"B","name":"Cibubur","is_active":true}"#
    private let katalog = #"{"items":[{"id":"m1","name":"Shawarma Ayam","price":25000,"is_available":true,"category_id":"c","category_name":"Shawarma"}]}"#

    private func rakit(outlets: String, tersimpan: String? = nil) -> (CatalogViewModel, OutletStore, CartStore, () -> Void) {
        GatewayRute.pasang([
            "/api/v1/outlets": (200, #"{"outlets":[\#(outlets)]}"#),
            "/api/v1/catalog": (200, katalog),
            "/api/v1/banners": (200, #"{"carousel":[]}"#),
        ])
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        let gateway = GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { nil },
                                    session: URLSession(configuration: konfig))
        let suite = "uji-katalog-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        let outletStore = OutletStore(defaults: d)
        if let tersimpan { outletStore.simpan(id: tersimpan, nama: "lama") }
        let cart = CartStore.diMemori()
        let vm = CatalogViewModel(repository: Repository(gateway: gateway), outletStore: outletStore, cart: cart)
        return (vm, outletStore, cart, { d.removePersistentDomain(forName: suite) })
    }

    @Test func satuOutletDipilihOtomatis() async {
        let (vm, store, _, bersih) = rakit(outlets: outletA); defer { bersih() }
        await vm.muat()
        #expect(vm.outlet?.id == "A")
        #expect(store.idTerpilih() == "A")
        #expect(vm.kategori.map(\.nama) == ["Shawarma"])
        #expect(!vm.memuat && !vm.perluPilihOutlet)
    }

    @Test func banyakOutletTanpaSimpananPerluPilih() async {
        let (vm, _, _, bersih) = rakit(outlets: "\(outletA),\(outletB)"); defer { bersih() }
        await vm.muat()
        #expect(vm.perluPilihOutlet)
        #expect(vm.outlet == nil)
    }

    @Test func outletTersimpanDipakai() async {
        let (vm, _, _, bersih) = rakit(outlets: "\(outletA),\(outletB)", tersimpan: "B"); defer { bersih() }
        await vm.muat()
        #expect(vm.outlet?.id == "B")
    }

    @Test func outletTersimpanYangDicabutTakDipakai() async {
        let (vm, _, _, bersih) = rakit(outlets: "\(outletA),\(outletB)", tersimpan: "X"); defer { bersih() }
        await vm.muat()
        #expect(vm.perluPilihOutlet)
    }

    @Test func tanpaOutletSamaSekali() async {
        let (vm, _, _, bersih) = rakit(outlets: ""); defer { bersih() }
        await vm.muat()
        #expect(vm.tidakAdaOutlet)
    }

    @Test func pindahOutletMengosongkanKeranjangDanMelapor() async {
        let (vm, _, cart, bersih) = rakit(outlets: "\(outletA),\(outletB)", tersimpan: "A"); defer { bersih() }
        await vm.muat()
        cart.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 1, catatan: nil)
        await vm.pilihOutlet(OutletDto(id: "B", name: "Cibubur", isActive: true))
        #expect(cart.isi().isEmpty)
        #expect(vm.keranjangDikosongkan)
        vm.akuiKeranjangDikosongkan()
        #expect(!vm.keranjangDikosongkan)
    }

    @Test func kueriMenyaringKategori() async {
        let (vm, _, _, bersih) = rakit(outlets: outletA); defer { bersih() }
        await vm.muat()
        vm.kueri = "tidak ada"
        #expect(vm.kategori.isEmpty)
        vm.kueri = ""
        #expect(vm.kategori.count == 1)
    }
}

/// URLProtocol palsu yang membalas per jalur URL.
final class GatewayRute: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var rute: [String: (Int, String)] = [:]
    /// Balasan berurutan per jalur (dipakai habis dulu sebelum `rute`).
    nonisolated(unsafe) static var antrean: [String: [(Int, String)]] = [:]
    nonisolated(unsafe) static var bodyTerakhir: [String: Data] = [:]

    static func pasang(_ r: [String: (Int, String)], antrean a: [String: [(Int, String)]] = [:]) {
        rute = r; antrean = a; bodyTerakhir = [:]
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let jalur = request.url?.path() ?? ""
        if let stream = request.httpBodyStream {
            stream.open()
            var data = Data(); var buf = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable { let n = stream.read(&buf, maxLength: buf.count); if n <= 0 { break }; data.append(buf, count: n) }
            stream.close()
            Self.bodyTerakhir[jalur] = data
        }
        let (status, body): (Int, String)
        if var q = Self.antrean[jalur], !q.isEmpty {
            (status, body) = q.removeFirst()
            Self.antrean[jalur] = q
        } else {
            (status, body) = Self.rute[jalur] ?? (404, #"{"error":"tidak_ada"}"#)
        }
        let resp = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil,
                                   headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
