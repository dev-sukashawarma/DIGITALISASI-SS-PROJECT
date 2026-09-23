import Testing
@testable import SukaShawarma

/// Porting `GatewayErrorTest.kt`.
struct GatewayErrorTests {
    private func kode(_ g: GatewayError) -> (String, String)? {
        if case .kode(let k, let p) = g { return (k, p) }
        return nil
    }

    @Test func status401SelaluSesiTidakSah() {
        guard case .sesiTidakSah = petakanGalat(status: 401, body: #"{"error":"Sesi tidak sah"}"#) else {
            Issue.record("bukan sesiTidakSah"); return
        }
    }

    @Test func pesananKadaluarsaDikenaliSebagaiKodeMesin() {
        let g = petakanGalat(status: 409, body: #"{"error":"pesanan_kadaluarsa","pesan":"Pesanan sebelumnya sudah kedaluwarsa."}"#)
        #expect(kode(g)?.0 == "pesanan_kadaluarsa")
        #expect(kode(g)?.1 == "Pesanan sebelumnya sudah kedaluwarsa.")
    }

    @Test func pesananSedangDiprosesDikenali() {
        let g = petakanGalat(status: 409, body: #"{"error":"pesanan_sedang_diproses","pesan":"Coba lagi sebentar."}"#)
        #expect(kode(g)?.0 == "pesanan_sedang_diproses")
    }

    @Test func kalimatBebasTetapTerbaca() {
        let g = petakanGalat(status: 409, body: #"{"error":"Outlet sedang tidak bisa menerima pesanan"}"#)
        #expect(kode(g)?.1 == "Outlet sedang tidak bisa menerima pesanan")
    }

    @Test func status502AdalahGalatServer() {
        guard case .server(502) = petakanGalat(status: 502, body: #"{"error":"Gagal memuat menu"}"#) else {
            Issue.record("bukan server(502)"); return
        }
    }

    @Test func bodyKosongAtauBukanJsonTidakCrash() {
        guard case .server = petakanGalat(status: 500, body: nil),
              case .server = petakanGalat(status: 500, body: "<html>gateway timeout</html>"),
              case .server = petakanGalat(status: 400, body: "<html>bad</html>")
        else { Issue.record("seharusnya server"); return }
    }
}
