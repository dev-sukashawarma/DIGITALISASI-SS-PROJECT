import Foundation

/// Padanan `ui/voucher/TampilanKartuVoucher.kt` — aturan tampilan kartu voucher.

/// Warna potongan kiri kartu. Dipetakan ke warna tema di `KartuVoucher`.
enum WarnaKartu { case oranye, cokelat, hijau, pudar }

private let namaBulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

/// Nilai besar + keterangan kecil di potongan kiri kartu. Sumbernya
/// `label_nilai`/`label_sub` gateway; gateway lama tetap mendapat teks.
func nilaiKartu(_ v: VoucherDto) -> (nilai: String, sub: String) {
    if let nilai = v.labelNilai { return (nilai, v.labelSub ?? "") }
    switch v.jenis {
    case "persen": return ("%", "potongan")
    case "gratis_item": return ("Gratis", "voucher")
    default: return ("Promo", "voucher")
    }
}

func warnaKartu(_ v: VoucherDto) -> WarnaKartu {
    if v.status != "berlaku" { return .pudar }
    switch v.jenis {
    case "persen": return .cokelat
    case "gratis_item", "beli_x_gratis_y": return .hijau
    default: return .oranye
    }
}

/// "s.d. 30 Sep" dalam WIB; nil bila tanpa tanggal atau tak terbaca.
func labelBerlakuSampai(_ selesaiIso: String?) -> String? {
    guard let selesaiIso, let ms = uraiWaktuIso(selesaiIso) else { return nil }
    var kal = Calendar(identifier: .gregorian)
    kal.timeZone = TimeZone(identifier: "Asia/Jakarta")!
    let k = kal.dateComponents([.day, .month], from: Date(timeIntervalSince1970: Double(ms) / 1000))
    guard let hari = k.day, let bulan = k.month else { return nil }
    return "s.d. \(hari) \(namaBulan[bulan - 1])"
}

/// Kalimat syarat tanpa bagian "s.d. …" bila tanggal yang sama sudah tampil
/// di baris ber-ikon jam. Kalimatnya dibuat gateway (identik dengan pratinjau
/// admin), jadi pemangkasan hanya terjadi di tampilan aplikasi.
func syaratTanpaTanggal(_ kalimat: String, berlakuSampai: String?) -> String {
    guard let berlakuSampai else { return kalimat }
    if kalimat == berlakuSampai { return "" }
    let akhiran = " · \(berlakuSampai)"
    return kalimat.hasSuffix(akhiran) ? String(kalimat.dropLast(akhiran.count)) : kalimat
}
