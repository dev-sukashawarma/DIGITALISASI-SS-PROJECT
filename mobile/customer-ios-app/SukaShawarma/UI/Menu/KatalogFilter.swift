import Foundation

/// Satu kelompok menu yang tampil dengan judulnya sendiri di katalog.
struct KategoriMenu: Equatable, Identifiable {
    let id: String?
    let nama: String
    let items: [MenuItemDto]

    var kunci: String { id ?? "tanpa-kategori:\(nama)" }
}

private let namaLainnya = "Lainnya"
private let namaKategoriTanpaNama = "Menu"

/// Padanan `kelompokkanPerKategori` (KatalogFilter.kt). Tiga aturan:
/// 1. **Tidak ada item yang hilang** (tanpa kategori, kategori tanpa nama, habis).
/// 2. **Urutan stabil** — urutan kemunculan jadi pemutus terakhir.
/// 3. **"Lainnya" selalu paling bawah.**
func kelompokkanPerKategori(_ items: [MenuItemDto]) -> [KategoriMenu] {
    var urutanMuncul: [String?] = []
    var kelompok: [String?: [MenuItemDto]] = [:]
    for m in items {
        if kelompok[m.categoryId] == nil { urutanMuncul.append(m.categoryId) }
        kelompok[m.categoryId, default: []].append(m)
    }

    // `sort_order` nil berarti "belum diatur", bukan nol — diletakkan di akhir.
    func urut(_ n: Int?) -> Int { n ?? Int.max }

    let hasil = urutanMuncul.enumerated().map { posisi, id -> (KategoriMenu, [Int]) in
        let isi = kelompok[id] ?? []
        let nama = id == nil ? namaLainnya : (isi.lazy.compactMap(\.categoryName).first ?? namaKategoriTanpaNama)
        let terurut = isi.sorted {
            (urut($0.sortOrder), $0.name.lowercased()) < (urut($1.sortOrder), $1.name.lowercased())
        }
        let kunciUrut = [
            id == nil ? 1 : 0,
            isi.map { urut($0.categorySortOrder) }.min() ?? Int.max,
            isi.map { urut($0.sortOrder) }.min() ?? Int.max,
            posisi,
        ]
        return (KategoriMenu(id: id, nama: nama, items: terurut), kunciUrut)
    }

    return hasil.sorted { $0.1.lexicographicallyPrecedes($1.1) }.map(\.0)
}

/// Kueri kosong mengembalikan seluruh daftar — BUKAN daftar kosong.
func saringPencarian(_ items: [MenuItemDto], kueri: String) -> [MenuItemDto] {
    let bersih = kueri.trimmingCharacters(in: .whitespaces).lowercased()
    guard !bersih.isEmpty else { return items }
    return items.filter {
        $0.name.lowercased().contains(bersih) || ($0.description?.lowercased().contains(bersih) ?? false)
    }
}

/// Topping yang ditawarkan di detail menu (logika dari `AppNavigation.kt`):
/// menu berkategori "Topping" yang tersedia — kecuali untuk menu yang dirinya
/// topping atau minuman ("Suka Drink").
func toppingUntuk(_ item: MenuItemDto, semua: [MenuItemDto]) -> [MenuItemDto] {
    func kategori(_ m: MenuItemDto, _ nama: String) -> Bool {
        m.categoryName?.caseInsensitiveCompare(nama) == .orderedSame
    }
    if kategori(item, "Topping") || kategori(item, "Suka Drink") { return [] }
    return semua.filter { kategori($0, "Topping") && $0.isAvailable }
}
