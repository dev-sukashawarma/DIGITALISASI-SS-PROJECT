import Foundation
import Security

/// Sesi pelanggan (token gateway) setara identitas pelanggan — WAJIB terenkripsi.
struct SessionData: Codable, Sendable, Equatable {
    let token: String
    let expiresAt: String
    var nama: String?
    var email: String?
    var telepon: String?
}

/// Padanan `data/SessionStore.kt`. Android memakai EncryptedSharedPreferences;
/// padanan iOS-nya adalah **Keychain**. Jangan pernah pindahkan ke
/// `UserDefaults` — itu berkas plist tak terenkripsi.
///
/// Seluruh sesi disimpan sebagai satu item JSON agar baca/tulis atomik.
/// `AfterFirstUnlockThisDeviceOnly`: tidak ikut ter-backup/terpindah ke
/// perangkat lain, tapi tetap terbaca oleh tugas latar setelah HP dibuka sekali.
final class SessionStore: Sendable {
    private let layanan: String
    private let akun = "sesi"

    init(layanan: String = "com.sukashawarma.customer.session") {
        self.layanan = layanan
    }

    private var kueriDasar: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: layanan,
            kSecAttrAccount as String: akun,
        ]
    }

    func simpan(token: String, expiresAt: String, nama: String? = nil,
                email: String? = nil, telepon: String? = nil) {
        let sesi = SessionData(token: token, expiresAt: expiresAt, nama: nama, email: email, telepon: telepon)
        guard let data = try? JSONEncoder().encode(sesi) else { return }

        let perbarui: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(kueriDasar as CFDictionary, perbarui as CFDictionary)
        if status == errSecItemNotFound {
            let tambah = kueriDasar.merging(perbarui) { $1 }
            SecItemAdd(tambah as CFDictionary, nil)
        }
    }

    func baca() -> SessionData? {
        var kueri = kueriDasar
        kueri[kSecReturnData as String] = true
        kueri[kSecMatchLimit as String] = kSecMatchLimitOne
        var hasil: AnyObject?
        guard SecItemCopyMatching(kueri as CFDictionary, &hasil) == errSecSuccess,
              let data = hasil as? Data
        else { return nil }
        return try? JSONDecoder().decode(SessionData.self, from: data)
    }

    /// Apakah masih ada sesi yang layak dipakai. Lihat [sesiMasihBerlaku].
    func adaSesiBerlaku() -> Bool {
        sesiMasihBerlaku(baca()?.expiresAt, sekarang: sekarangMilidetik())
    }

    func hapus() {
        SecItemDelete(kueriDasar as CFDictionary)
    }
}
