package com.sukashawarma.customer.ui.screens.checkout

import com.sukashawarma.customer.data.api.CartProblemDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Rencana menyebut DTO ini `MasalahKeranjangDto`. Nama yang benar-benar ada di
 * kode -- dan yang mencerminkan balasan gateway -- adalah `CartProblemDto`
 * (dibuat di Task 4). Namanya tidak diubah hanya demi mencocokkan draf
 * rencana.
 */
class ValidasiPesanTest {

    private fun masalah(nama: String, jenis: String, hargaBaru: Double? = null) =
        CartProblemDto(menuItemId = "m1", name = nama, jenis = jenis, hargaBaru = hargaBaru)

    @Test
    fun `item habis dijelaskan dengan namanya`() {
        val p = pesanUntukMasalah(masalah("Shawarma Ayam Original", "habis"))
        assertTrue(p.contains("Shawarma Ayam Original"))
        assertTrue(p.contains("habis"))
    }

    @Test
    fun `harga berubah menyebutkan harga barunya`() {
        val p = pesanUntukMasalah(masalah("Shawarma Ayam Original", "harga_berubah", 28000.0))
        assertTrue(p.contains("28.000"))
    }

    @Test
    fun `harga berubah tanpa angka baru tetap menghasilkan kalimat utuh`() {
        // Gateway selalu mengirim `harga_baru` untuk jenis ini, tapi kalimatnya
        // tidak boleh berubah jadi "Rp null" kalau suatu saat tidak dikirim.
        val p = pesanUntukMasalah(masalah("Shawarma Ayam Original", "harga_berubah"))
        assertTrue(p.contains("Shawarma Ayam Original"))
        assertTrue(!p.contains("null"))
    }

    @Test
    fun `item yang sudah tidak ada dijelaskan tanpa istilah teknis`() {
        val p = pesanUntukMasalah(masalah("Menu Lama", "tidak_ada"))
        assertTrue(p.contains("Menu Lama"))
        assertTrue(!p.contains("tidak_ada"))
    }

    @Test
    fun `jenis masalah yang tidak dikenal tetap menghasilkan kalimat, bukan kosong`() {
        val p = pesanUntukMasalah(masalah("Sesuatu", "jenis_baru"))
        assertTrue(p.isNotBlank())
        assertTrue(!p.contains("jenis_baru"))
    }

    @Test
    fun `hanya harga berubah yang menawarkan penerimaan harga baru`() {
        assertEquals("Pakai harga baru", labelTindakan(masalah("A", "harga_berubah", 1000.0)))
        assertEquals("Hapus dari keranjang", labelTindakan(masalah("A", "habis")))
        assertEquals("Hapus dari keranjang", labelTindakan(masalah("A", "tidak_ada")))
    }

    @Test
    fun `alasan tingkat pesanan diterjemahkan tanpa kode mesin`() {
        assertTrue(pesanUntukAlasan("outlet_tutup", null).contains("tutup"))
        assertTrue(!pesanUntukAlasan("outlet_tidak_melayani", null).contains("_"))
    }

    @Test
    fun `alasan tak dikenal memakai kalimat dari gateway bila ada`() {
        assertEquals(
            "Outlet ini belum melayani pesanan aplikasi",
            pesanUntukAlasan("alasan_baru", "Outlet ini belum melayani pesanan aplikasi")
        )
    }

    @Test
    fun `alasan tak dikenal tanpa kalimat gateway tetap menghasilkan kalimat`() {
        assertTrue(pesanUntukAlasan(null, null).isNotBlank())
    }
}
