import Foundation

/// Padanan `ui/home/StatusOutletLabel.kt`.
extension OutletDto {
    /// Gateway lama (tanpa `bisa_pesan`) = perilaku lama: ikut `isActive`.
    var bolehPesan: Bool { bisaPesan ?? isActive }
}

/// "Buka", "Buka · pesan terakhir 21.30" (jam WIB), atau kalimat tutup dari
/// gateway ("Outlet belum buka. Buka pukul 14.00.") — jatuh ke "Tutup".
func labelStatusOutlet(_ o: OutletDto) -> String {
    if o.bolehPesan {
        if let terakhir = o.pesanTerakhir.flatMap(jamWib) { return "Buka · pesan terakhir \(terakhir)" }
        return "Buka"
    }
    return o.pesanStatus ?? "Tutup"
}

/// Keterangan tutup untuk layar yang menahan tombol pesan; nil bila bisa pesan.
func labelOutletTutup(_ o: OutletDto?) -> String? {
    guard let o, !o.bolehPesan else { return nil }
    return labelStatusOutlet(o)
}

/// "HH.mm" di Asia/Jakarta dari cap waktu ISO gateway; nil bila tak terurai.
private func jamWib(_ iso: String) -> String? {
    guard let ms = uraiWaktuIso(iso) else { return nil }
    var kal = Calendar(identifier: .gregorian)
    kal.timeZone = TimeZone(identifier: "Asia/Jakarta")!
    let k = kal.dateComponents([.hour, .minute], from: Date(timeIntervalSince1970: Double(ms) / 1000))
    guard let jam = k.hour, let menit = k.minute else { return nil }
    return String(format: "%02d.%02d", jam, menit)
}
