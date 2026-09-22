import Foundation

private let polaIso = try! NSRegularExpression(
    pattern: #"^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*([Zz]|[+-]\d{2}:?\d{2})?$"#
)

/// Padanan `uraiWaktuIso` (SessionStore.kt). Mengurai cap waktu ISO-8601
/// gateway menjadi milidetik epoch.
///
/// Gateway mengirim DUA bentuk: `2026-09-07T03:23:34.097Z` (JS
/// `toISOString`) dan `2026-09-07T10:23:34.097+07:00` (PostgREST
/// `timestamptz`), dengan pecahan detik 0/3/6 digit. Keduanya WAJIB dikenali —
/// gagal senyap di sini membuat pembayaran tak pernah bisa dimulai.
///
/// Sengaja bukan `ISO8601DateFormatter`: ia menolak pecahan 6 digit dan
/// offset tanpa titik dua, dua bentuk yang memang dikirim gateway.
func uraiWaktuIso(_ iso: String) -> Int64? {
    let teks = iso.trimmingCharacters(in: .whitespacesAndNewlines)
    let rentang = NSRange(teks.startIndex..., in: teks)
    guard let m = polaIso.firstMatch(in: teks, range: rentang) else { return nil }

    func grup(_ i: Int) -> String {
        guard let r = Range(m.range(at: i), in: teks) else { return "" }
        return String(teks[r])
    }

    var kal = Calendar(identifier: .gregorian)
    kal.timeZone = TimeZone(identifier: "UTC")!
    let komponen = DateComponents(
        calendar: kal, timeZone: kal.timeZone,
        year: Int(grup(1)), month: Int(grup(2)), day: Int(grup(3)),
        hour: Int(grup(4)), minute: Int(grup(5)), second: Int(grup(6))
    )
    // Setara `Calendar.isLenient = false`: 2026-13-45T99:99:99 ditolak.
    guard komponen.isValidDate, let tanggal = komponen.date else { return nil }

    // Ambil tiga digit pertama pecahan; mikrodetik dibuang, bukan dianggap gagal.
    let pecahan = grup(7)
    let milidetik = pecahan.isEmpty ? 0 : Int64(String((pecahan + "000").prefix(3))) ?? 0

    // Offset kosong diperlakukan sebagai UTC.
    let offset = grup(8)
    var geser: Int64 = 0
    if !offset.isEmpty && offset.uppercased() != "Z" {
        let tanda: Int64 = offset.hasPrefix("-") ? -1 : 1
        let angka = offset.dropFirst().replacingOccurrences(of: ":", with: "")
        guard angka.count == 4, let jam = Int64(angka.prefix(2)), let menit = Int64(angka.suffix(2))
        else { return nil }
        geser = tanda * (jam * 60 + menit) * 60_000
    }

    let epochUtc = Int64((tanggal.timeIntervalSince1970 * 1000).rounded())
    return epochUtc + milidetik - geser
}

/// Padanan `sesiMasihBerlaku`. Hanya kemudahan untuk melewati layar masuk —
/// gateway tetap satu-satunya penentu. Karena itu tanggal yang TIDAK BISA
/// DIURAI dianggap masih berlaku (biar gateway yang menolak dengan 401).
func sesiMasihBerlaku(_ expiresAt: String?, sekarang: Int64) -> Bool {
    guard let expiresAt else { return false }
    guard let kedaluwarsa = uraiWaktuIso(expiresAt) else { return true }
    return kedaluwarsa > sekarang
}

/// Milidetik epoch saat ini (padanan `System.currentTimeMillis()`).
func sekarangMilidetik() -> Int64 {
    Int64((Date().timeIntervalSince1970 * 1000).rounded())
}

/// Waktu singkat untuk kartu riwayat & notifikasi, selalu WIB dan berbahasa
/// Indonesia (bukan ikut setelan perangkat): "7 Sep 2026, 10.23".
/// Nil bila cap waktu tak terbaca — kartu cukup tak menampilkan waktu.
func formatWaktuPendek(_ iso: String?) -> String? {
    guard let iso, let ms = uraiWaktuIso(iso) else { return nil }
    let f = DateFormatter()
    f.locale = Locale(identifier: "id_ID")
    f.timeZone = TimeZone(identifier: "Asia/Jakarta")
    f.dateFormat = "d MMM yyyy, HH.mm"
    return f.string(from: Date(timeIntervalSince1970: Double(ms) / 1000))
}
