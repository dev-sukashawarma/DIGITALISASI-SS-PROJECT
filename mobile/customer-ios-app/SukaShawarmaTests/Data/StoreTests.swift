import Foundation
import Testing
@testable import SukaShawarma

/// Tidak ada padanan uji di Android (di sana EncryptedSharedPreferences butuh
/// perangkat). Di iOS Keychain simulator bisa diuji langsung.
@Suite(.serialized)
struct SessionStoreTests {
    private let store = SessionStore(layanan: "com.sukashawarma.customer.session.uji")

    @Test func simpanBacaHapus() {
        store.hapus()
        #expect(store.baca() == nil)

        store.simpan(token: "tok-1", expiresAt: "2099-01-01T00:00:00.000Z", nama: "Budi", email: "b@x.id")
        #expect(store.baca()?.token == "tok-1")
        #expect(store.baca()?.nama == "Budi")
        #expect(store.adaSesiBerlaku())

        // Simpan ulang menimpa, bukan menggandakan.
        store.simpan(token: "tok-2", expiresAt: "2000-01-01T00:00:00.000Z")
        #expect(store.baca()?.token == "tok-2")
        #expect(store.baca()?.nama == nil)
        #expect(!store.adaSesiBerlaku())

        store.hapus()
        #expect(store.baca() == nil)
        #expect(!store.adaSesiBerlaku())
    }
}

struct OutletStoreTests {
    @Test func simpanBacaHapus() {
        let suite = "uji-outlet-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = OutletStore(defaults: defaults)

        #expect(store.idTerpilih() == nil)
        store.simpan(id: "o1", nama: "Empang")
        #expect(store.idTerpilih() == "o1")
        #expect(store.namaTerpilih() == "Empang")
        store.hapus()
        #expect(store.idTerpilih() == nil)
        #expect(store.namaTerpilih() == nil)
    }
}
