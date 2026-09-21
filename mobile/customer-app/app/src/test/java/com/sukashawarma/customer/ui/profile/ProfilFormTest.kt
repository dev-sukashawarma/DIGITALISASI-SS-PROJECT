package com.sukashawarma.customer.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ProfilFormTest {

    @Test
    fun `semua cara menulis nomor jadi 628xxxx`() {
        assertEquals("6281234567890", ProfilForm.normalisasiWhatsApp("081234567890"))
        assertEquals("6281234567890", ProfilForm.normalisasiWhatsApp("+6281234567890"))
        assertEquals("6281234567890", ProfilForm.normalisasiWhatsApp("6281234567890"))
        assertEquals("6281234567890", ProfilForm.normalisasiWhatsApp("0812-3456-7890"))
        assertEquals("6281234567890", ProfilForm.normalisasiWhatsApp("0812 3456 7890"))
    }

    @Test
    fun `bukan nomor HP Indonesia ditolak`() {
        assertNull(ProfilForm.normalisasiWhatsApp("0212345678"))
        assertNull(ProfilForm.normalisasiWhatsApp("12345"))
        assertNull(ProfilForm.normalisasiWhatsApp("+15551234567"))
        assertNull(ProfilForm.normalisasiWhatsApp("08123"))
        assertNull(ProfilForm.normalisasiWhatsApp("08abc4567890"))
    }

    @Test
    fun `nomor kosong sah, nomor salah diberi pesan`() {
        assertNull(ProfilForm.galatWhatsApp(""))
        assertNull(ProfilForm.galatWhatsApp("   "))
        assertNotNull(ProfilForm.galatWhatsApp("12345"))
        assertNull(ProfilForm.galatWhatsApp("0812 3456 7890"))
    }

    @Test
    fun `nama dirapikan dan dibatasi`() {
        assertEquals("Maulana Yusuf", ProfilForm.rapikanNama("  Maulana   Yusuf "))
        assertNotNull(ProfilForm.galatNama(" A "))
        assertNotNull(ProfilForm.galatNama("x".repeat(ProfilForm.NAMA_MAKS + 1)))
        assertNull(ProfilForm.galatNama("Budi"))
    }

    @Test
    fun `nomor tersimpan ditampilkan dengan awalan 0`() {
        assertEquals("081234567890", ProfilForm.untukIsian("6281234567890"))
        assertEquals("", ProfilForm.untukIsian(null))
        assertEquals("081234", ProfilForm.untukIsian("081234"))
    }
}
