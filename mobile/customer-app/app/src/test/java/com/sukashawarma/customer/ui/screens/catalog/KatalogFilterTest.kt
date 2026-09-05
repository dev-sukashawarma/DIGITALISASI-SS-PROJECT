package com.sukashawarma.customer.ui.screens.catalog

import com.sukashawarma.customer.data.api.MenuItemDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private fun item(
    id: String,
    nama: String,
    kategori: String?,
    urut: Int?,
    tersedia: Boolean = true,
    namaKategori: String? = null,
    urutKategori: Int? = null,
    deskripsi: String? = null
) = MenuItemDto(
    id = id, name = nama, description = deskripsi, price = 25000.0,
    imageUrl = null, isAvailable = tersedia, categoryId = kategori, sortOrder = urut,
    categoryName = namaKategori, categorySortOrder = urutKategori
)

class KatalogFilterTest {

    @Test
    fun `mengelompokkan per kategori dan mengurutkan sesuai sort_order`() {
        val hasil = kelompokkanPerKategori(
            listOf(
                item("b", "Kebab Mini", "c1", 2),
                item("a", "Shawarma Ayam Original", "c1", 1),
                item("c", "Es Teh Manis", "c2", 1),
            )
        )
        assertEquals(2, hasil.size)
        assertEquals(listOf("a", "b"), hasil[0].items.map { it.id })
    }

    @Test
    fun `item tanpa kategori masuk kelompok Lainnya, bukan hilang`() {
        val hasil = kelompokkanPerKategori(listOf(item("a", "Tanpa kategori", null, 1)))
        assertEquals(1, hasil.size)
        assertEquals(1, hasil[0].items.size)
        assertEquals("Lainnya", hasil[0].nama)
    }

    @Test
    fun `item habis tetap ditampilkan, tidak disembunyikan`() {
        val hasil = kelompokkanPerKategori(listOf(item("a", "Habis", "c1", 1, tersedia = false)))
        assertEquals(1, hasil[0].items.size)
    }

    @Test
    fun `sort_order null diletakkan di akhir, bukan menyebabkan crash`() {
        val hasil = kelompokkanPerKategori(
            listOf(item("a", "Tanpa urutan", "c1", null), item("b", "Punya urutan", "c1", 1))
        )
        assertEquals(listOf("b", "a"), hasil[0].items.map { it.id })
    }

    @Test
    fun `kelompok diurutkan memakai sort_order kategori dari gateway`() {
        val hasil = kelompokkanPerKategori(
            listOf(
                item("a", "Es Teh", "c2", 1, namaKategori = "Minuman", urutKategori = 2),
                item("b", "Shawarma", "c1", 1, namaKategori = "Makanan", urutKategori = 1),
            )
        )
        assertEquals(listOf("Makanan", "Minuman"), hasil.map { it.nama })
    }

    @Test
    fun `kelompok Lainnya selalu di paling bawah walau urutan kategorinya kecil`() {
        val hasil = kelompokkanPerKategori(
            listOf(
                item("a", "Tanpa kategori", null, 1),
                item("b", "Shawarma", "c1", 1, namaKategori = "Makanan", urutKategori = 9),
            )
        )
        assertEquals(listOf("Makanan", "Lainnya"), hasil.map { it.nama })
    }

    @Test
    fun `kategori tanpa nama tidak menghilangkan itemnya`() {
        // Gateway lama (belum di-redeploy) tidak mengirim category_name.
        // Menu harus tetap terbit; hanya judul kelompoknya yang generik.
        val hasil = kelompokkanPerKategori(listOf(item("a", "Shawarma", "c1", 1)))
        assertEquals(1, hasil.size)
        assertEquals(listOf("a"), hasil[0].items.map { it.id })
    }

    @Test
    fun `pencarian mencocokkan nama tanpa peduli huruf besar kecil`() {
        val semua = listOf(
            item("a", "Shawarma Ayam Original", "c1", 1),
            item("b", "Es Teh Manis", "c2", 1),
        )
        assertEquals(listOf("a"), saringPencarian(semua, "shawarma").map { it.id })
        assertEquals(listOf("a"), saringPencarian(semua, "  AYAM ").map { it.id })
    }

    @Test
    fun `pencarian juga mencocokkan deskripsi`() {
        val semua = listOf(
            item("a", "Paket Hemat", "c1", 1, deskripsi = "Ayam panggang dan saus khas"),
            item("b", "Es Teh Manis", "c2", 1),
        )
        assertEquals(listOf("a"), saringPencarian(semua, "panggang").map { it.id })
    }

    @Test
    fun `kueri kosong mengembalikan semuanya, bukan nol`() {
        val semua = listOf(item("a", "Shawarma", "c1", 1), item("b", "Es Teh", "c2", 1))
        assertEquals(2, saringPencarian(semua, "").size)
        assertEquals(2, saringPencarian(semua, "   ").size)
    }

    @Test
    fun `kueri tanpa hasil mengembalikan daftar kosong, bukan seluruh menu`() {
        val semua = listOf(item("a", "Shawarma", "c1", 1))
        assertTrue(saringPencarian(semua, "nasi goreng").isEmpty())
    }
}
