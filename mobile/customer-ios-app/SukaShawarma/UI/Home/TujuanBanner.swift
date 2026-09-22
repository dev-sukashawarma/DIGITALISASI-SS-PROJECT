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

/// Kurasi "Menu Terlaris" di Beranda — logika yang di Android tertanam di
/// `HomeScreen`, diangkat ke sini agar bisa diuji. Satu menu tersedia pertama
/// yang namanya memuat tiap kata kunci; kalau tak ada yang cocok, dua menu
/// tersedia pertama.
func pilihMenuTerlaris(_ semua: [MenuItemDto], kataKunci: [String] = ["Ayam", "Sapi"]) -> [MenuItemDto] {
    var cocok: [MenuItemDto] = []
    for kata in kataKunci {
        if let m = semua.first(where: { $0.isAvailable && $0.name.localizedCaseInsensitiveContains(kata) }),
           !cocok.contains(m) {
            cocok.append(m)
        }
    }
    return cocok.isEmpty ? Array(semua.filter(\.isAvailable).prefix(2)) : Array(cocok.prefix(2))
}
