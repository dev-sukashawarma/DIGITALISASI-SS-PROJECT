import Foundation
import Observation

/// Padanan `LoginViewModel.kt`, ditambah jalur Apple.
@MainActor
@Observable
final class LoginViewModel {
    enum Penyedia { case google, apple }

    private(set) var memuat: Penyedia?
    private(set) var pesanGalat: String?
    private(set) var berhasil = false

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let sessionStore: SessionStore

    init(repository: Repository, sessionStore: SessionStore) {
        self.repository = repository
        self.sessionStore = sessionStore
    }

    func mulai(_ p: Penyedia) { memuat = p; pesanGalat = nil }

    /// Pelanggan menutup lembar masuk sendiri: BUKAN galat, tanpa pesan merah.
    func dibatalkan() { memuat = nil }

    func gagalSebelumGateway(_ pesan: String) {
        memuat = nil
        pesanGalat = pesan
    }

    func bersihkanGalat() { pesanGalat = nil }

    func tukarGoogle(idToken: String) async {
        await terapkan(await repository.loginGoogle(idToken: idToken), penyedia: .google)
    }

    func tukarApple(idToken: String, nonce: String, nama: String?) async {
        await terapkan(await repository.loginApple(idToken: idToken, nonce: nonce, nama: nama), penyedia: .apple)
    }

    private func terapkan(_ hasil: GatewayResult<AuthResponse>, penyedia: Penyedia) async {
        memuat = nil
        switch hasil {
        case .sukses(let a):
            sessionStore.simpan(token: a.token, expiresAt: a.expiresAt, nama: a.customer.name,
                                email: a.customer.email, telepon: a.customer.phone)
            berhasil = true
        case .gagal(let g):
            pesanGalat = pesanMasuk(g, penyedia: penyedia)
        }
    }
}

/// 401 di layar Masuk BUKAN "sesi berakhir" — belum ada sesi. Artinya gateway
/// menolak ID token-nya. Kalimat umum `pesanGalat` akan menyuruh pelanggan
/// "masuk lagi" dari dalam layar masuk itu sendiri.
func pesanMasuk(_ g: GatewayError, penyedia: LoginViewModel.Penyedia) -> String {
    let nama = penyedia == .google ? "Google" : "Apple"
    switch g {
    case .sesiTidakSah:
        return "\(nama) menolak masuk. Coba lagi, atau pakai akun lain."
    case .server(404) where penyedia == .apple:
        // Endpoint `auth/apple` belum ada di gateway (RANCANGAN.md §5 butir 2).
        return "Masuk dengan Apple belum tersedia. Untuk sementara, masuk dengan Google."
    default:
        return pesanGalat(g)
    }
}
