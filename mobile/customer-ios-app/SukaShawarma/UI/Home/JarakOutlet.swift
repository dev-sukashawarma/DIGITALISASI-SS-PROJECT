import Foundation

/// Padanan `ui/home/JarakOutlet.kt`. Posisi di bumi, derajat desimal.
struct Koordinat: Equatable, Sendable {
    let lat: Double
    let lng: Double
}

private let jariJariBumiM = 6_371_000.0

/// Jarak garis lurus (haversine), BUKAN jarak jalan. Cukup untuk mengurutkan
/// outlet terdekat; jangan dipakai untuk menjanjikan waktu tempuh.
func jarakMeter(_ a: Koordinat, _ b: Koordinat) -> Double {
    func rad(_ d: Double) -> Double { d * .pi / 180 }
    let dLat = rad(b.lat - a.lat)
    let dLng = rad(b.lng - a.lng)
    let h = sin(dLat / 2) * sin(dLat / 2) + cos(rad(a.lat)) * cos(rad(b.lat)) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * jariJariBumiM * asin(sqrt(min(max(h, 0), 1)))
}

/// nil kalau outlet tak punya koordinat lengkap — bukan 0, bukan tebakan.
func jarakOutlet(_ outlet: OutletDto, _ posisi: Koordinat) -> Double? {
    guard let lat = outlet.lat, let lng = outlet.lng else { return nil }
    return jarakMeter(posisi, Koordinat(lat: lat, lng: lng))
}

/// Mengurutkan outlet: yang buka di atas, lalu
///  - dengan `posisi`: terdekat dulu; outlet tanpa koordinat di bawah, alfabetis.
///  - tanpa posisi (izin ditolak / lokasi mati): alfabetis.
func urutkanOutlet(_ outlets: [OutletDto], posisi: Koordinat? = nil) -> [OutletDto] {
    outlets.sorted { a, b in
        if a.isActive != b.isActive { return a.isActive }
        if let posisi {
            let ja = jarakOutlet(a, posisi), jb = jarakOutlet(b, posisi)
            if (ja == nil) != (jb == nil) { return ja != nil }
            if let ja, let jb, ja != jb { return ja < jb }
        }
        return a.name.lowercased() < b.name.lowercased()
    }
}

/// Outlet yang otomatis dipilih untuk pelanggan baru: yang aktif dan paling
/// dekat. Hanya outlet berkoordinat yang ikut — nil bila tak ada satu pun,
/// supaya pelanggan memilih sendiri alih-alih diberi tebakan.
///
/// Sengaja memakai `isActive`, BUKAN jam buka (`bisa_pesan`): outlet terdekat
/// yang belum buka pukul 09.00 tetap outlet yang benar untuk pelanggan itu.
func pilihOutletTerdekat(_ outlets: [OutletDto], posisi: Koordinat) -> OutletDto? {
    urutkanOutlet(outlets.filter { jarakOutlet($0, posisi) != nil }, posisi: posisi).first
}

/// "850 m" di bawah 1 km (puluhan meter), "1,2 km", lalu "125 km" dari 100 km.
func labelJarak(_ meter: Double) -> String {
    let puluhan = Int64((meter / 10).rounded()) * 10
    if puluhan < 1_000 { return "\(max(puluhan, 10)) m" }
    let km = meter / 1_000
    if km >= 100 { return "\(Int64(km.rounded())) km" }
    let sepersepuluh = Int64((km * 10).rounded())
    return "\(sepersepuluh / 10),\(sepersepuluh % 10) km"
}
