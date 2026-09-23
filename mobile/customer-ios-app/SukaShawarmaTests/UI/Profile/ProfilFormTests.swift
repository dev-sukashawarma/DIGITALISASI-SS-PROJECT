import Foundation
import Testing
@testable import SukaShawarma

/// Porting `ProfilFormTest.kt` (5/5).
struct ProfilFormTests {
    @Test func semuaCaraMenulisNomorJadi628() {
        for n in ["081234567890", "+6281234567890", "6281234567890", "0812-3456-7890", "0812 3456 7890", "(0812) 3456.7890"] {
            #expect(ProfilForm.normalisasiWhatsApp(n) == "6281234567890", "\(n)")
        }
    }

    @Test func bukanNomorHPIndonesiaDitolak() {
        for n in ["0212345678", "12345", "+15551234567", "08123", "08abc4567890"] {
            #expect(ProfilForm.normalisasiWhatsApp(n) == nil, "\(n)")
        }
    }

    @Test func nomorKosongSahNomorSalahDiberiPesan() {
        #expect(ProfilForm.galatWhatsApp("") == nil)
        #expect(ProfilForm.galatWhatsApp("   ") == nil)
        #expect(ProfilForm.galatWhatsApp("12345") != nil)
        #expect(ProfilForm.galatWhatsApp("0812 3456 7890") == nil)
    }

    @Test func namaDirapikanDanDibatasi() {
        #expect(ProfilForm.rapikanNama("  Maulana   Yusuf ") == "Maulana Yusuf")
        #expect(ProfilForm.galatNama(" A ") != nil)
        #expect(ProfilForm.galatNama(String(repeating: "x", count: ProfilForm.namaMaks + 1)) != nil)
        #expect(ProfilForm.galatNama("Budi") == nil)
    }

    @Test func nomorTersimpanDenganAwalan0() {
        #expect(ProfilForm.untukIsian("6281234567890") == "081234567890")
        #expect(ProfilForm.untukIsian(nil) == "")
        #expect(ProfilForm.untukIsian("081234") == "081234")
    }
}

/// Porting `InformasiAkunTest.kt` (5/5).
struct InformasiAkunTests {
    @Test func inisialDuaKataPertama() {
        #expect(InformasiAkun.inisial("Maulana Yusuf") == "MY")
        #expect(InformasiAkun.inisial("maulana yusuf ibrahim") == "MY")
    }
    @Test func inisialSatuKata() { #expect(InformasiAkun.inisial("Maulana") == "M") }
    @Test func inisialTahanSpasi() { #expect(InformasiAkun.inisial("  Maulana    Yusuf  ") == "MY") }
    @Test func namaKosongJadiSS() {
        #expect(InformasiAkun.inisial(nil) == "SS")
        #expect(InformasiAkun.inisial("   ") == "SS")
    }
    @Test func teksKosongDianggapTidakAda() {
        #expect(InformasiAkun.teksAtauNil(nil) == nil)
        #expect(InformasiAkun.teksAtauNil("  ") == nil)
        #expect(InformasiAkun.teksAtauNil(" 08123 ") == "08123")
    }
}

/// `InformasiAkunViewModel` — tanpa padanan uji di Android.
@MainActor
@Suite(.serialized)
struct InformasiAkunViewModelTests {
    private let jalur = "/api/v1/customer/profile"

    private func rakit(_ antrean: [(Int, String)]) -> (InformasiAkunViewModel, SessionStore) {
        GatewayRute.pasang([:], antrean: [jalur: antrean])
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        let sesi = SessionStore(layanan: "com.sukashawarma.customer.session.uji-akun")
        sesi.simpan(token: "t", expiresAt: "2099-01-01T00:00:00.000Z", nama: "Budi", email: "b@x.id", telepon: "6281111111111")
        let gateway = GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { sesi.baca()?.token },
                                    session: URLSession(configuration: konfig))
        return (InformasiAkunViewModel(repository: Repository(gateway: gateway), sessionStore: sesi), sesi)
    }

    @Test func isianAwalDariSesiDenganAwalan0() {
        let (vm, sesi) = rakit([]); defer { sesi.hapus() }
        #expect(vm.nama == "Budi" && vm.whatsApp == "081111111111" && vm.email == "b@x.id")
        #expect(!vm.adaPerubahan)
    }

    @Test func galatDitampilkanTanpaMenghubungiGateway() async {
        let (vm, sesi) = rakit([]); defer { sesi.hapus() }
        vm.nama = "A"
        vm.whatsApp = "12345"
        await vm.simpan()
        #expect(vm.galatNama != nil && vm.galatWhatsApp != nil)
        #expect(GatewayRute.bodyTerakhir[jalur] == nil)
        vm.nama = "Andi"
        #expect(vm.galatNama == nil)
    }

    @Test func hanyaYangBerubahDikirimLaluSesiDiperbarui() async throws {
        let (vm, sesi) = rakit([(200, #"{"customer":{"id":"c","name":"Budi Santoso","email":"b@x.id","phone":"6281111111111"}}"#)])
        defer { sesi.hapus() }
        vm.nama = "  Budi   Santoso "
        await vm.simpan()

        let body = try #require(GatewayRute.bodyTerakhir[jalur])
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["name"] as? String == "Budi Santoso")
        #expect(json["phone"] == nil)

        #expect(vm.tersimpan && !vm.adaPerubahan && vm.nama == "Budi Santoso")
        #expect(sesi.baca()?.nama == "Budi Santoso")
    }

    @Test func penyegaranAwalTakMenimpaYangSedangDiketik() async {
        let (vm, sesi) = rakit([(200, #"{"customer":{"id":"c","name":"Nama Server","phone":null}}"#)])
        defer { sesi.hapus() }
        vm.nama = "Sedang Diketik"
        await vm.segarkan()
        #expect(vm.nama == "Sedang Diketik")
        #expect(vm.namaTersimpan == "Nama Server")
    }

    @Test func galatGatewayDitampilkan() async {
        let (vm, sesi) = rakit([(400, #"{"error":"nomor_tidak_sah","pesan":"Nomor WhatsApp tidak sah."}"#)])
        defer { sesi.hapus() }
        vm.whatsApp = "0812 3456 7890"
        await vm.simpan()
        #expect(vm.pesanGalat == "Nomor WhatsApp tidak sah.")
        #expect(!vm.menyimpan && !vm.tersimpan)
    }
}
