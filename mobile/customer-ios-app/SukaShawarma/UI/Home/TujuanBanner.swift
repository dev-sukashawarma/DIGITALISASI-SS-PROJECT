import Foundation

/// Padanan `ui/home/TujuanBanner.kt`: ke mana ketukan banner membawa pelanggan.
///
/// Daftar tertutup dengan sengaja: banner TIDAK boleh membuka URL bebas —
/// siapa pun yang bisa menulis baris banner akan bisa mengarahkan pelanggan
/// ke alamat mana saja.
enum TujuanBanner: Equatable {
    case tidakAda
    case menu
    case item(menuItemId: String)
}

/// Aksi tak dikenal jatuh ke `.tidakAda`, bukan crash — aplikasi terpasang
/// harus tetap hidup kalau gateway mengirim aksi yang lebih baru.
func tujuanBanner(aksi: String, targetMenuItemId: String?) -> TujuanBanner {
    switch aksi {
    case "menu": return .menu
    case "menu_item":
        guard let id = targetMenuItemId, !id.trimmingCharacters(in: .whitespaces).isEmpty else { return .tidakAda }
        return .item(menuItemId: id)
    default: return .tidakAda
    }
}

/// Popup tampil sekali per banner per pelanggan (keputusan owner K3).
func popupBolehTampil(popupId: String?, sudahDilihat: Set<String>) -> Bool {
    guard let popupId, !popupId.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
    return !sudahDilihat.contains(popupId)
}

/// Beranda menampilkan grid 2 kolom.
let jumlahMenuTerlaris = 2

/// Padanan `ui/home/MenuTerlaris.kt`. Urutan kurasi admin (`menu_terlaris_ids`
/// dari /config) diikuti, melewati menu yang tidak ada di katalog outlet ini
/// atau sedang habis -- yang di bawahnya otomatis naik. Kalau tak satu pun
/// tersisa, aturan lama (kata kunci) dipakai supaya bagian ini tidak kosong.
func pilihMenuTerlaris(_ semua: [MenuItemDto], kurasiIds: [String] = [],
                       kataKunci: [String] = ["Ayam", "Sapi"]) -> [MenuItemDto] {
    let tersedia = semua.filter(\.isAvailable)
    var sudah = Set<String>()
    let dariKurasi = kurasiIds.filter { sudah.insert($0).inserted }
        .compactMap { id in tersedia.first(where: { $0.id == id }) }
        .prefix(jumlahMenuTerlaris)
    if !dariKurasi.isEmpty { return Array(dariKurasi) }

    var cocok: [MenuItemDto] = []
    for kata in kataKunci {
        if let m = tersedia.first(where: { $0.name.localizedCaseInsensitiveContains(kata) }), !cocok.contains(m) {
            cocok.append(m)
        }
    }
    return Array((cocok.isEmpty ? tersedia : cocok).prefix(jumlahMenuTerlaris))
}
