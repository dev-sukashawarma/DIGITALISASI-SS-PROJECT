import CryptoKit
import Foundation

/// Masuk dengan Google TANPA SDK: alur OAuth "installed app" standar (RFC 8252)
/// lewat `ASWebAuthenticationSession` + PKCE (RFC 7636) — cara yang sama yang
/// dipakai GoogleSignIn-iOS di dalamnya, tanpa 4 dependensi pihak ketiga.
///
/// Hasil akhirnya sama dengan Android: sebuah **ID token Google** yang langsung
/// ditukar ke gateway (`POST /api/v1/auth/google`). Aplikasi tak memvalidasi
/// token sendiri dan tak pernah bicara ke Supabase.
///
/// Dua catatan yang tidak boleh diubah diam-diam:
/// - **Tanpa nonce**, sama dengan Android (lihat komentar di `GoogleSignIn.kt`):
///   menambah nonce mewajibkan gateway meneruskannya ke Supabase.
/// - ID token dari client **iOS** ber-*audience* iOS client ID, bukan web client
///   ID. Gateway/Supabase WAJIB menerima audience itu (RANCANGAN.md §5 butir 1).
enum MasukGoogle {
    static let endpointOtorisasi = URL(string: "https://accounts.google.com/o/oauth2/v2/auth")!
    static let endpointToken = URL(string: "https://oauth2.googleapis.com/token")!

    /// `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`
    /// (skema pengalihan resmi untuk OAuth client bertipe iOS).
    static func skemaBalik(_ clientID: String) -> String {
        clientID.split(separator: ".").reversed().joined(separator: ".")
    }

    static func redirectURI(_ clientID: String) -> String { "\(skemaBalik(clientID)):/oauth2redirect" }

    struct PKCE: Equatable {
        let verifier: String
        let challenge: String

        static func baru() -> PKCE {
            var acak = [UInt8](repeating: 0, count: 32)
            _ = SecRandomCopyBytes(kSecRandomDefault, acak.count, &acak)
            return dari(verifier: base64URL(Data(acak)))
        }

        /// `challenge = BASE64URL(SHA256(verifier))`, metode S256.
        static func dari(verifier: String) -> PKCE {
            PKCE(verifier: verifier, challenge: base64URL(Data(SHA256.hash(data: Data(verifier.utf8)))))
        }
    }

    static func urlOtorisasi(clientID: String, pkce: PKCE, state: String) -> URL {
        var k = URLComponents(url: endpointOtorisasi, resolvingAgainstBaseURL: false)!
        k.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI(clientID)),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: pkce.challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            // Selalu tampilkan pemilih akun (setara setFilterByAuthorizedAccounts(false)).
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        return k.url!
    }

    enum Galat: Error, Equatable {
        case stateTakCocok
        case tanpaKode
        case ditolak(String)
        case tanpaIdToken
    }

    /// Mengurai URL pengalihan. `state` WAJIB sama dengan yang dikirim (anti-CSRF).
    static func kodeDari(callback: URL, stateDiharapkan: String) throws -> String {
        let q = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func nilai(_ n: String) -> String? { q.first { $0.name == n }?.value }
        if let e = nilai("error") { throw Galat.ditolak(e) }
        guard nilai("state") == stateDiharapkan else { throw Galat.stateTakCocok }
        guard let kode = nilai("code"), !kode.isEmpty else { throw Galat.tanpaKode }
        return kode
    }

    /// Menukar kode otorisasi dengan ID token (tanpa client secret — client iOS tak punya).
    static func tukarKode(_ kode: String, clientID: String, pkce: PKCE,
                          session: URLSession = .shared) async throws -> String {
        var req = URLRequest(url: endpointToken)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var k = URLComponents()
        k.queryItems = [
            URLQueryItem(name: "grant_type", value: "authorization_code"),
            URLQueryItem(name: "code", value: kode),
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI(clientID)),
            URLQueryItem(name: "code_verifier", value: pkce.verifier),
        ]
        req.httpBody = Data((k.percentEncodedQuery ?? "").utf8)
        let (data, _) = try await session.data(for: req)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        if let e = json?["error"] as? String { throw Galat.ditolak(e) }
        guard let token = json?["id_token"] as? String else { throw Galat.tanpaIdToken }
        return token
    }
}

/// Klaim yang aman dicatat dari sebuah ID token (JWT) — TANPA tanda tangan,
/// tanpa token utuh. Untuk diagnosis "ditolak" di build Debug saja.
func klaimAmanIdToken(_ jwt: String) -> [String: String] {
    let bagian = jwt.split(separator: ".")
    guard bagian.count >= 2 else { return [:] }
    var b64 = bagian[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    while b64.count % 4 != 0 { b64 += "=" }
    guard let data = Data(base64Encoded: b64),
          let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [:] }
    var hasil: [String: String] = [:]
    for k in ["aud", "azp", "iss", "email"] { if let v = json[k] { hasil[k] = "\(v)" } }
    hasil["nonce"] = json["nonce"] == nil ? "tidak ada" : "ada"
    return hasil
}

func base64URL(_ data: Data) -> String {
    data.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

/// Masuk dengan Apple: nonce mentah dikirim ke gateway, versi SHA-256-nya ke
/// Apple. Gateway meneruskan nonce mentah ke Supabase `signInWithIdToken`,
/// yang mencocokkannya dengan klaim `nonce` di ID token (anti replay).
enum MasukApple {
    static func nonceBaru() -> String {
        var acak = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, acak.count, &acak)
        return base64URL(Data(acak))
    }

    static func sha256Hex(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// Apple hanya mengirim nama pada masuk PERTAMA — gabungkan bila ada.
    static func namaLengkap(_ n: PersonNameComponents?) -> String? {
        guard let n else { return nil }
        let teks = PersonNameComponentsFormatter.localizedString(from: n, style: .default)
            .trimmingCharacters(in: .whitespaces)
        return teks.isEmpty ? nil : teks
    }
}
