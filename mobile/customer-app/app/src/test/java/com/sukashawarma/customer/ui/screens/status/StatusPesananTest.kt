package com.sukashawarma.customer.ui.screens.status

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusPesananTest {

    @Test
    fun `semua nilai yang sah di constraint produksi punya pemetaan`() {
        // orders_status_check: 'pending','preparing','ready','completed','cancelled'
        listOf("pending", "preparing", "ready", "completed", "cancelled").forEach {
            assertTrue("status $it tidak punya judul", tampilanStatus(it).judul.isNotBlank())
        }
    }

    @Test
    fun `belum ada status dapur berarti menunggu pembayaran`() {
        val t = tampilanStatus(null)
        assertNull(t.tahap)
        assertTrue(t.judul.contains("pembayaran"))
    }

    @Test
    fun `preparing dipetakan ke sedang dibuat`() {
        assertEquals(TahapPesanan.DIBUAT, tampilanStatus("preparing").tahap)
    }

    @Test
    fun `ready dipetakan ke siap diambil`() {
        assertEquals(TahapPesanan.SIAP, tampilanStatus("ready").tahap)
    }

    @Test
    fun `completed ditandai selesai, bukan sekadar siap`() {
        val t = tampilanStatus("completed")
        assertTrue(t.selesai)
        assertEquals(TahapPesanan.SIAP, t.tahap)
    }

    @Test
    fun `cancelled ditandai dibatalkan dan tanpa tahap`() {
        val t = tampilanStatus("cancelled")
        assertTrue(t.dibatalkan)
        assertNull(t.tahap)
    }

    @Test
    fun `status asing tetap menghasilkan kalimat, bukan layar kosong`() {
        val t = tampilanStatus("status_baru_dari_pos")
        assertTrue(t.judul.isNotBlank())
        assertTrue(t.penjelasan.isNotBlank())
    }

    @Test
    fun `tahap sebelumnya ikut tertandai selesai`() {
        // Pesanan aplikasi masuk langsung sebagai `preparing`. Kalau "Diterima"
        // tidak ikut tertandai, garis waktunya seolah melompati tahap pertama.
        val tahap = tampilanStatus("preparing").tahap
        assertTrue(tahapTercapai(tahap, TahapPesanan.DITERIMA))
        assertTrue(tahapTercapai(tahap, TahapPesanan.DIBUAT))
        assertFalse(tahapTercapai(tahap, TahapPesanan.SIAP))
    }

    @Test
    fun `tanpa tahap tidak ada yang tertandai selesai`() {
        assertFalse(tahapTercapai(null, TahapPesanan.DITERIMA))
    }
}
