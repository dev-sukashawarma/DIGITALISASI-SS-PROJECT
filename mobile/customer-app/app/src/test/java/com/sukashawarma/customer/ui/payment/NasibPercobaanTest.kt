package com.sukashawarma.customer.ui.payment

import org.junit.Assert.assertEquals
import org.junit.Test

class NasibPercobaanTest {

    /** 2026-09-07T11:00:00Z */
    private val sekarang = 1788778800000L

    @Test
    fun `draft yang batas waktunya lewat harus memulai pesanan baru`() {
        assertEquals(
            NasibPercobaan.MULAI_BARU,
            nasibPercobaan("menunggu_bayar", "2026-09-07T10:23:00.000Z", sekarang)
        )
    }

    @Test
    fun `draft yang masih dalam batas waktu tetap dipantau`() {
        assertEquals(
            NasibPercobaan.LANJUTKAN,
            nasibPercobaan("menunggu_bayar", "2026-09-07T11:10:00.000Z", sekarang)
        )
    }

    @Test
    fun `batas waktu yang TIDAK diketahui tidak boleh membuang percobaan`() {
        // Gateway lama tidak mengirim expires_at. Membuang percobaan atas
        // dasar tebakan berarti membuat tagihan KEDUA untuk pesanan yang
        // mungkin masih hidup.
        assertEquals(
            NasibPercobaan.LANJUTKAN,
            nasibPercobaan("menunggu_bayar", null, sekarang)
        )
    }

    @Test
    fun `batas waktu yang tak bisa diurai juga tidak membuang percobaan`() {
        assertEquals(
            NasibPercobaan.LANJUTKAN,
            nasibPercobaan("menunggu_bayar", "entah apa ini", sekarang)
        )
    }

    @Test
    fun `status kadaluarsa langsung memulai pesanan baru`() {
        assertEquals(
            NasibPercobaan.MULAI_BARU,
            nasibPercobaan("kadaluarsa", null, sekarang)
        )
    }

    @Test
    fun `status dibayar dan gagal dikenali`() {
        assertEquals(NasibPercobaan.DIBAYAR, nasibPercobaan("dibayar", null, sekarang))
        assertEquals(NasibPercobaan.GAGAL, nasibPercobaan("gagal", null, sekarang))
    }

    @Test
    fun `status asing diperlakukan sebagai masih hidup, bukan ditagih ulang`() {
        assertEquals(
            NasibPercobaan.LANJUTKAN,
            nasibPercobaan("status_baru", null, sekarang)
        )
    }

    @Test
    fun `tepat pada detik kedaluwarsa sudah dianggap mati`() {
        assertEquals(
            NasibPercobaan.MULAI_BARU,
            nasibPercobaan("menunggu_bayar", "2026-09-07T11:00:00.000Z", sekarang)
        )
    }
}
