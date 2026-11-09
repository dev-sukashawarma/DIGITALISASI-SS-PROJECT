import Foundation

/// Padanan `ui/components/Inisial.kt`. Inisial avatar pelanggan: huruf pertama
/// dua kata pertama nama, lalu huruf pertama email bila nama kosong. Satu
/// sumber untuk SEMUA avatar — dulu header menampilkan "SK" yang ditulis mati,
/// sehingga pelanggan melihat inisial orang lain di Beranda.
func inisialNama(_ nama: String?, email: String? = nil) -> String {
    let dariNama = (nama ?? "")
        .split(whereSeparator: \.isWhitespace)
        .compactMap { kata in kata.first(where: { $0.isLetter || $0.isNumber }) }
        .prefix(2)
        .map { String($0).uppercased() }
        .joined()
    if !dariNama.isEmpty { return dariNama }
    if let huruf = email?.trimmingCharacters(in: .whitespaces).first(where: { $0.isLetter || $0.isNumber }) {
        return String(huruf).uppercased()
    }
    return "?"
}
