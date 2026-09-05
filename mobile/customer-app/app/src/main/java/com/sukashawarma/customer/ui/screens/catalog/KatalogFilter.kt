package com.sukashawarma.customer.ui.screens.catalog

import com.sukashawarma.customer.data.api.MenuItemDto

/** Satu kelompok menu yang tampil dengan judulnya sendiri di katalog. */
data class KategoriMenu(
    val id: String?,
    val nama: String,
    val items: List<MenuItemDto>
)

private const val NAMA_LAINNYA = "Lainnya"
private const val NAMA_KATEGORI_TANPA_NAMA = "Menu"

/**
 * Mengelompokkan katalog per kategori untuk ditampilkan.
 *
 * Tiga aturan yang tidak boleh dilanggar:
 *
 * 1. **Tidak ada item yang boleh hilang.** Item tanpa kategori, kategori tanpa
 *    nama, dan item yang sedang habis semuanya tetap terbit. Menu yang lenyap
 *    membuat pelanggan mengira menunya memang tidak pernah ada; menu yang
 *    diredupkan menjelaskan dirinya sendiri.
 * 2. **Urutan harus stabil.** Data yang sama harus menghasilkan susunan yang
 *    sama setiap kali, termasuk ketika `sort_order` seluruhnya null. Karena
 *    itu urutan kemunculan di daftar asal dipakai sebagai pemutus terakhir,
 *    bukan urutan HashMap yang tak dijamin.
 * 3. **"Lainnya" selalu paling bawah**, berapa pun angka urutan kategori lain.
 */
fun kelompokkanPerKategori(items: List<MenuItemDto>): List<KategoriMenu> {
    val kelompok = LinkedHashMap<String?, MutableList<MenuItemDto>>()
    for (it in items) {
        kelompok.getOrPut(it.categoryId) { mutableListOf() }.add(it)
    }

    val urutanMuncul = kelompok.keys.toList()

    return kelompok.entries
        .map { (id, isi) ->
            KategoriMenu(
                id = id,
                nama = when {
                    id == null -> NAMA_LAINNYA
                    else -> isi.firstNotNullOfOrNull { it.categoryName }
                        ?: NAMA_KATEGORI_TANPA_NAMA
                },
                items = isi.sortedWith(
                    // `sort_order` null berarti "belum diatur", bukan nol.
                    // Mengurutkannya sebagai nol akan melempar item yang belum
                    // diatur ke paling atas -- persis kebalikan dari maksudnya.
                    compareBy<MenuItemDto> { it.sortOrder ?: Int.MAX_VALUE }
                        .thenBy { it.name.lowercase() }
                )
            )
        }
        .sortedWith(
            compareBy<KategoriMenu> { if (it.id == null) 1 else 0 }
                .thenBy { kelompok[it.id]?.minOfOrNull { m -> m.categorySortOrder ?: Int.MAX_VALUE } ?: Int.MAX_VALUE }
                .thenBy { kelompok[it.id]?.minOfOrNull { m -> m.sortOrder ?: Int.MAX_VALUE } ?: Int.MAX_VALUE }
                .thenBy { urutanMuncul.indexOf(it.id) }
        )
}

/**
 * Menyaring katalog dengan kata kunci pencarian.
 *
 * Kueri kosong mengembalikan seluruh daftar -- bukan daftar kosong. Kekeliruan
 * arah ini membuat katalog tampak kosong begitu kolom pencarian dibersihkan.
 */
fun saringPencarian(items: List<MenuItemDto>, kueri: String): List<MenuItemDto> {
    val bersih = kueri.trim().lowercase()
    if (bersih.isEmpty()) return items
    return items.filter {
        it.name.lowercase().contains(bersih) ||
            (it.description?.lowercase()?.contains(bersih) == true)
    }
}
