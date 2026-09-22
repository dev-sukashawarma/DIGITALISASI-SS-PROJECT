import Foundation

/// Padanan `ui/format/Rupiah.kt`: `Rp25.000`, titik sebagai pemisah ribuan,
/// tanpa desimal.
///
/// Sengaja TIDAK memakai `NumberFormatter` mata uang — hasilnya ikut bahasa
/// perangkat, sehingga iPhone ber-locale en-US menampilkan "IDR 25,000.00".
///
/// Harga gateway berupa Double; pembulatan dilakukan sekali di sini, dengan
/// aturan yang sama seperti `roundToLong` Kotlin (setengah dibulatkan ke atas,
/// termasuk untuk negatif: -2,5 → -2).
func rupiah(_ nilai: Double) -> String {
    rupiah(bulatkanRupiah(nilai))
}

/// Padanan `Double.roundToLong()` Kotlin. Dipakai juga saat harga masuk ke
/// keranjang: pembulatan dilakukan SEKALI, dan gateway membandingkan
/// `unit_price` dengan katalog memakai kesamaan persis.
func bulatkanRupiah(_ nilai: Double) -> Int64 {
    Int64((nilai + 0.5).rounded(.down))
}

func rupiah(_ nilai: Int64) -> String {
    let angka = String(nilai.magnitude)
    var hasil = ""
    for (i, c) in angka.enumerated() {
        if i > 0 && (angka.count - i) % 3 == 0 { hasil.append(".") }
        hasil.append(c)
    }
    return nilai < 0 ? "-Rp\(hasil)" : "Rp\(hasil)"
}
