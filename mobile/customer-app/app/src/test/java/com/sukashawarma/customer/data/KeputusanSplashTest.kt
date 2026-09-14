package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KeputusanSplashTest {

    @Test
    fun `durasi dibatasi 1 sampai 5 detik`() {
        assertEquals(1_000L, KeputusanSplash.batasiDurasi(10))
        assertEquals(5_000L, KeputusanSplash.batasiDurasi(60_000))
        assertEquals(2_000L, KeputusanSplash.batasiDurasi(2_000))
    }

    @Test
    fun `durasi kosong atau tak masuk akal jatuh ke 3 detik`() {
        assertEquals(3_000L, KeputusanSplash.batasiDurasi(null))
        assertEquals(3_000L, KeputusanSplash.batasiDurasi(0))
        assertEquals(3_000L, KeputusanSplash.batasiDurasi(-500))
    }

    @Test
    fun `unduh saat admin memasang gambar baru`() {
        assertTrue(KeputusanSplash.perluUnduh("https://x/b.webp", "https://x/a.webp", berkasAda = true))
        assertTrue(KeputusanSplash.perluUnduh("https://x/a.webp", null, berkasAda = false))
    }

    @Test
    fun `tidak mengunduh ulang gambar yang sama`() {
        assertFalse(KeputusanSplash.perluUnduh("https://x/a.webp", "https://x/a.webp", berkasAda = true))
    }

    @Test
    fun `unduh ulang bila alamat tercatat tapi berkasnya hilang`() {
        assertTrue(KeputusanSplash.perluUnduh("https://x/a.webp", "https://x/a.webp", berkasAda = false))
    }

    @Test
    fun `tidak mengunduh saat admin memilih gambar bawaan`() {
        assertFalse(KeputusanSplash.perluUnduh(null, "https://x/a.webp", berkasAda = true))
    }

    @Test
    fun `hapus simpanan hanya saat admin memilih gambar bawaan`() {
        assertTrue(KeputusanSplash.perluHapus(null, "https://x/a.webp"))
        assertFalse(KeputusanSplash.perluHapus(null, null))
        assertFalse(KeputusanSplash.perluHapus("https://x/a.webp", "https://x/a.webp"))
    }
}
