import Foundation
import Testing
@testable import SukaShawarma

/// Perilaku `CheckoutViewModel` — di Android tak diuji, padahal inilah
/// penjaga terakhir sebelum pelanggan dikirim ke pembayaran.
@MainActor
@Suite(.serialized)
struct CheckoutViewModelTests {
    private let jalur = "/api/v1/checkout/validate"

    private func rakit(_ balasan: [(Int, String)]) -> (CheckoutViewModel, CartStore) {
        GatewayRute.pasang([:], antrean: [jalur: balasan])
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        let gateway = GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { "t" },
                                    session: URLSession(configuration: konfig))
        let cart = CartStore.diMemori()
        cart.pakaiOutlet("A")
        cart.tambah(menuItemId: "m1", nama: "Shawarma", hargaSatuan: 25000, jumlah: 2, catatan: nil,
                    toppings: [CartTopping(menuItemId: "t1", nama: "Keju", hargaSatuan: 7000)])
        cart.tambah(menuItemId: "m2", nama: "Es Teh", hargaSatuan: 8000, jumlah: 1, catatan: nil)
        return (CheckoutViewModel(repository: Repository(gateway: gateway), cart: cart), cart)
    }

    @Test func lolosMemakaiAngkaGatewayBukanHitunganSendiri() async throws {
        let (vm, _) = rakit([(200, #"{"ok":true,"subtotal":72000,"discountAmount":5000.4,"total":66999.6}"#)])
        await vm.validasi()
        #expect(vm.bolehLanjut)
        #expect(vm.subtotal == 72000 && vm.potongan == 5000 && vm.total == 67000)

        // Payload: 3 baris (item, topping, item), dikirim ke outlet keranjang.
        let body = try #require(GatewayRute.bodyTerakhir[jalur])
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["outlet_id"] as? String == "A")
        #expect((json["items"] as? [[String: Any]])?.count == 3)
    }

    @Test func ok200FalseAdalahPenolakan() async {
        let (vm, _) = rakit([(200, #"{"ok":false,"alasan":"outlet_tutup","total":99}"#)])
        await vm.validasi()
        #expect(!vm.bolehLanjut)
        #expect(vm.total == nil)
        #expect(vm.pesanPenolakan?.contains("tutup") == true)
    }

    @Test func pakaiHargaBaruLaluValidasiUlang() async {
        let (vm, cart) = rakit([
            (200, #"{"ok":false,"masalah":[{"menu_item_id":"m1","name":"Shawarma","jenis":"harga_berubah","harga_baru":28000}]}"#),
            (200, #"{"ok":true,"subtotal":78000,"total":78000}"#),
        ])
        await vm.validasi()
        #expect(vm.masalah.count == 1 && !vm.bolehLanjut)

        await vm.perbaiki(vm.masalah[0])
        #expect(cart.isi().first { $0.menuItemId == "m1" }?.hargaSatuan == 28000)
        #expect(vm.bolehLanjut && vm.total == 78000)
    }

    @Test func itemHabisDibuangTanpaMembuangSisaKeranjang() async {
        let (vm, cart) = rakit([
            (200, #"{"ok":false,"masalah":[{"menu_item_id":"m2","name":"Es Teh","jenis":"habis"}]}"#),
            (200, #"{"ok":true,"subtotal":64000,"total":64000}"#),
        ])
        await vm.validasi()
        await vm.perbaikiSemua()
        #expect(cart.isi().map(\.menuItemId) == ["m1"])
        #expect(vm.bolehLanjut)
    }

    @Test func buangSemuaItemMengosongkanTotalLama() async {
        let (vm, cart) = rakit([(200, #"{"ok":true,"subtotal":72000,"total":72000}"#)])
        await vm.validasi()
        #expect(vm.bolehLanjut)
        cart.kosongkan()
        await vm.validasi()
        #expect(vm.keranjangKosong && !vm.bolehLanjut && vm.total == nil)
    }

    @Test func sesiHabisDilaporkan() async {
        let (vm, _) = rakit([(401, #"{"error":"Sesi tidak sah"}"#)])
        await vm.validasi()
        guard case .sesiTidakSah? = vm.galat else { Issue.record("harus sesiTidakSah"); return }
        #expect(!vm.bolehLanjut)
    }
}
