import Foundation

/// Lama splash bawaan bila belum pernah menerima pengaturan dari admin.
let durasiSplashBawaanMs: Int64 = 3_000
let durasiSplashMinMs: Int64 = 1_000
let durasiSplashMaksMs: Int64 = 5_000

/// Padanan `KeputusanSplash` (SplashStore.kt) — keputusan murni yang diuji.
enum KeputusanSplash {
    /// Dibatasi 1–5 detik; nilai tak masuk akal jatuh ke 3 detik.
    static func batasiDurasi(_ ms: Int64?) -> Int64 {
        guard let ms, ms > 0 else { return durasiSplashBawaanMs }
        return min(max(ms, durasiSplashMinMs), durasiSplashMaksMs)
    }

    /// Unduh bila admin memasang gambar DAN (gambarnya berbeda ATAU berkasnya hilang).
    static func perluUnduh(urlServer: String?, urlTersimpan: String?, berkasAda: Bool) -> Bool {
        urlServer != nil && (urlServer != urlTersimpan || !berkasAda)
    }

    /// Admin memilih gambar bawaan: buang gambar tersimpan.
    static func perluHapus(urlServer: String?, urlTersimpan: String?) -> Bool {
        urlServer == nil && urlTersimpan != nil
    }
}

/// Padanan `SplashStore.kt`: splash terakhir dari admin, disimpan di HP.
///
/// Splash tampil SEBELUM ada data jaringan, jadi yang tampil selalu simpanan
/// pembukaan sebelumnya; pengaturan baru terlihat pada pembukaan berikutnya.
///
/// Urutan tulis disengaja: berkas ditulis atomik DULU, BARU alamatnya dicatat.
/// Kalau terputus di tengah jalan, `perluUnduh` mengunduh ulang, bukan
/// menampilkan gambar setengah jadi.
final class SplashStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let berkas: URL

    private static let kunciUrl = "gambar_url"
    private static let kunciDurasi = "durasi_ms"

    init(defaults: UserDefaults = UserDefaults(suiteName: "splash_aplikasi") ?? .standard,
         folder: URL? = nil) {
        self.defaults = defaults
        let dasar = folder ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dasar, withIntermediateDirectories: true)
        berkas = dasar.appending(path: "splash_gambar")
    }

    func durasiMs() -> Int64 {
        let tersimpan = defaults.object(forKey: Self.kunciDurasi) as? NSNumber
        return KeputusanSplash.batasiDurasi(tersimpan?.int64Value)
    }

    func urlTersimpan() -> String? { defaults.string(forKey: Self.kunciUrl) }

    /// Lewat FileManager, BUKAN `URL.resourceValues` — yang terakhir menyimpan
    /// cache di objek URL, sehingga berkas yang sudah dihapus masih terbaca ada
    /// (dan `perluUnduh` tak akan pernah mengunduh ulang).
    func berkasAda() -> Bool {
        let atribut = try? FileManager.default.attributesOfItem(atPath: berkas.path(percentEncoded: false))
        return ((atribut?[.size] as? NSNumber)?.intValue ?? 0) > 0
    }

    /// Data gambar tersimpan, atau nil bila memakai gambar bawaan aplikasi.
    func dataGambar() -> Data? {
        guard urlTersimpan() != nil, berkasAda() else { return nil }
        return try? Data(contentsOf: berkas)
    }

    func simpanDurasi(_ ms: Int64) {
        defaults.set(KeputusanSplash.batasiDurasi(ms), forKey: Self.kunciDurasi)
    }

    func simpanGambar(url: String, data: Data) {
        // `.atomic` = tulis ke berkas sementara lalu ganti nama (padanan renameTo).
        guard (try? data.write(to: berkas, options: .atomic)) != nil else { return }
        defaults.set(url, forKey: Self.kunciUrl)
    }

    func hapusGambar() {
        defaults.removeObject(forKey: Self.kunciUrl)
        try? FileManager.default.removeItem(at: berkas)
    }
}

/// Padanan `PerbaruiSplash.kt`: menyegarkan simpanan splash untuk pembukaan
/// BERIKUTNYA. Kegagalan apa pun diabaikan dan simpanan lama dibiarkan utuh;
/// yang membuang gambar HANYA balasan sukses yang menyatakan gambar bawaan.
func perbaruiSplash(repository: Repository, store: SplashStore) async {
    guard case .sukses(let splash) = await repository.splash() else { return }

    let urlServer = splash.gambarUrl
    store.simpanDurasi(Int64(splash.durasiMs))

    if KeputusanSplash.perluHapus(urlServer: urlServer, urlTersimpan: store.urlTersimpan()) {
        store.hapusGambar()
        return
    }
    if let urlServer,
       KeputusanSplash.perluUnduh(urlServer: urlServer, urlTersimpan: store.urlTersimpan(), berkasAda: store.berkasAda()),
       let data = await repository.unduhGambarSplash(url: urlServer) {
        store.simpanGambar(url: urlServer, data: data)
    }
}
