package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Bentuk-bentuk di bawah DISALIN dari balasan produksi, bukan dikarang.
 * Pengurai versi pertama hanya mengenali bentuk `Z` dan menolak bentuk
 * ber-offset -- kegagalan senyap yang membuat pembayaran tidak pernah bisa
 * dimulai.
 */
class UraiWaktuIsoTest {

    @Test
    fun `bentuk Z dari Date toISOString JavaScript`() {
        assertEquals(1788751414097L, uraiWaktuIso("2026-09-07T03:23:34.097Z"))
    }

    @Test
    fun `bentuk ber-offset dari PostgREST menghasilkan waktu yang SAMA`() {
        // +07:00 pukul 10:23:34 = 03:23:34 UTC. Inilah yang dulu ditolak.
        assertEquals(
            uraiWaktuIso("2026-09-07T03:23:34.097Z"),
            uraiWaktuIso("2026-09-07T10:23:34.097+07:00")
        )
    }

    @Test
    fun `mikrodetik enam digit diterima, tidak dianggap gagal`() {
        // created_at dari PostgREST berbentuk begini.
        val a = uraiWaktuIso("2026-09-07T10:08:34.123577+07:00")
        assertEquals(uraiWaktuIso("2026-09-07T10:08:34.123+07:00"), a)
    }

    @Test
    fun `tanpa pecahan detik tetap terurai`() {
        assertEquals(
            uraiWaktuIso("2026-09-07T03:23:34.000Z"),
            uraiWaktuIso("2026-09-07T03:23:34Z")
        )
    }

    @Test
    fun `offset negatif digeser ke arah sebaliknya`() {
        // -05:00 pukul 22:23:34 tanggal 6 = 03:23:34 UTC tanggal 7.
        assertEquals(
            uraiWaktuIso("2026-09-07T03:23:34.097Z"),
            uraiWaktuIso("2026-09-06T22:23:34.097-05:00")
        )
    }

    @Test
    fun `offset tanpa titik dua juga diterima`() {
        assertEquals(
            uraiWaktuIso("2026-09-07T10:23:34.097+07:00"),
            uraiWaktuIso("2026-09-07T10:23:34.097+0700")
        )
    }

    @Test
    fun `string sampah tetap menghasilkan null`() {
        assertNull(uraiWaktuIso("entah apa ini"))
        assertNull(uraiWaktuIso(""))
        assertNull(uraiWaktuIso("2026-09-07"))
    }

    @Test
    fun `tanggal yang tidak masuk akal ditolak`() {
        assertNull(uraiWaktuIso("2026-13-45T99:99:99Z"))
    }
}
