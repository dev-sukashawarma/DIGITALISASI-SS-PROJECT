import Foundation
import Testing
@testable import SukaShawarma

struct MasukGoogleTests {
    private let clientID = "401597244561-abc123.apps.googleusercontent.com"

    @Test func pkceSesuaiContohRFC7636() {
        // Vektor uji resmi RFC 7636 Lampiran B.
        let p = MasukGoogle.PKCE.dari(verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
        #expect(p.challenge == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    }

    @Test func pkceBaruSelaluAcakDanSah() {
        let a = MasukGoogle.PKCE.baru(), b = MasukGoogle.PKCE.baru()
        #expect(a != b)
        #expect(a.verifier.count >= 43 && !a.verifier.contains("=") && !a.verifier.contains("+"))
    }

    @Test func skemaBalikDanRedirect() {
        #expect(MasukGoogle.skemaBalik(clientID) == "com.googleusercontent.apps.401597244561-abc123")
        #expect(MasukGoogle.redirectURI(clientID) == "com.googleusercontent.apps.401597244561-abc123:/oauth2redirect")
    }

    @Test func urlOtorisasiLengkapTanpaNonce() throws {
        let url = MasukGoogle.urlOtorisasi(clientID: clientID, pkce: .dari(verifier: "v"), state: "s1")
        let q = Dictionary(uniqueKeysWithValues: (URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? [])
            .map { ($0.name, $0.value ?? "") })
        #expect(url.host() == "accounts.google.com")
        #expect(q["response_type"] == "code" && q["code_challenge_method"] == "S256" && q["state"] == "s1")
        #expect(q["scope"] == "openid email profile")
        #expect(q["nonce"] == nil)  // sama dengan Android: tanpa nonce
    }

    @Test func callbackDiurai() throws {
        let ok = URL(string: "com.googleusercontent.apps.x:/oauth2redirect?state=s1&code=K0DE")!
        #expect(try MasukGoogle.kodeDari(callback: ok, stateDiharapkan: "s1") == "K0DE")

        let stateLain = URL(string: "com.googleusercontent.apps.x:/oauth2redirect?state=jahat&code=K")!
        #expect(throws: MasukGoogle.Galat.stateTakCocok) { try MasukGoogle.kodeDari(callback: stateLain, stateDiharapkan: "s1") }

        let ditolak = URL(string: "com.googleusercontent.apps.x:/oauth2redirect?error=access_denied&state=s1")!
        #expect(throws: MasukGoogle.Galat.ditolak("access_denied")) { try MasukGoogle.kodeDari(callback: ditolak, stateDiharapkan: "s1") }
    }
}

struct MasukAppleTests {
    @Test func nonceDiHashSha256() {
        #expect(MasukApple.sha256Hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        #expect(MasukApple.nonceBaru() != MasukApple.nonceBaru())
    }

    @Test func namaHanyaBilaAda() {
        var n = PersonNameComponents(); n.givenName = "Budi"; n.familyName = "Santoso"
        #expect(MasukApple.namaLengkap(n)?.contains("Budi") == true)
        #expect(MasukApple.namaLengkap(PersonNameComponents()) == nil)
        #expect(MasukApple.namaLengkap(nil) == nil)
    }
}

@MainActor
@Suite(.serialized)
struct LoginViewModelTests {
    private func rakit(_ rute: [String: (Int, String)]) -> (LoginViewModel, SessionStore) {
        GatewayRute.pasang(rute)
        let konfig = URLSessionConfiguration.ephemeral
        konfig.protocolClasses = [GatewayRute.self]
        let sesi = SessionStore(layanan: "com.sukashawarma.customer.session.uji-masuk")
        sesi.hapus()
        let repo = Repository(gateway: GatewayClient(baseURL: URL(string: "https://gateway.uji")!, token: { sesi.baca()?.token },
                                                     session: URLSession(configuration: konfig)))
        return (LoginViewModel(repository: repo, sessionStore: sesi), sesi)
    }
    private let auth = #"{"token":"T","expires_at":"2099-01-01T00:00:00Z","customer":{"id":"c","name":"Budi","email":"b@x.id","phone":null}}"#

    @Test func googleBerhasilMenyimpanSesi() async {
        let (vm, sesi) = rakit(["/api/v1/auth/google": (200, auth)]); defer { sesi.hapus() }
        vm.mulai(.google)
        await vm.tukarGoogle(idToken: "id")
        #expect(vm.berhasil && vm.memuat == nil)
        #expect(sesi.baca()?.token == "T" && sesi.baca()?.nama == "Budi")
    }

    @Test func appleMengirimTokenNonceDanNama() async throws {
        let (vm, sesi) = rakit(["/api/v1/auth/apple": (200, auth)]); defer { sesi.hapus() }
        await vm.tukarApple(idToken: "apple-jwt", nonce: "mentah", nama: "Budi Santoso")
        let body = try #require(GatewayRute.bodyTerakhir["/api/v1/auth/apple"])
        let json = try #require(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["id_token"] as? String == "apple-jwt" && json["nonce"] as? String == "mentah"
                && json["name"] as? String == "Budi Santoso")
        #expect(vm.berhasil)
    }

    @Test func tokenDitolakBukanSesiBerakhir() async {
        let (vm, sesi) = rakit(["/api/v1/auth/google": (401, "{}")]); defer { sesi.hapus() }
        await vm.tukarGoogle(idToken: "id")
        #expect(vm.pesanGalat == "Google menolak masuk. Coba lagi, atau pakai akun lain.")
        #expect(!vm.berhasil && sesi.baca() == nil)
    }

    @Test func endpointAppleBelumAda() async {
        let (vm, sesi) = rakit(["/api/v1/auth/apple": (404, "<html>404</html>")]); defer { sesi.hapus() }
        await vm.tukarApple(idToken: "x", nonce: "n", nama: nil)
        #expect(vm.pesanGalat?.contains("Apple belum tersedia") == true)
    }

    @Test func dibatalkanTanpaPesanMerah() {
        let (vm, _) = rakit([:])
        vm.mulai(.apple)
        vm.dibatalkan()
        #expect(vm.memuat == nil && vm.pesanGalat == nil)
    }
}
