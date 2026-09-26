package com.sukashawarma.customer.ui.voucher

import com.sukashawarma.customer.data.api.VoucherDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TampilanKartuVoucherTest {

    private fun v(
        jenis: String = "nominal",
        status: String = "berlaku",
        labelNilai: String? = "Rp5rb",
        labelSub: String? = "potongan",
        selesai: String? = null
    ) = VoucherDto(
        id = "v1", nama = "Uji", jenis = jenis, kalimatSyarat = "Potongan Rp5.000",
        selesai = selesai, status = status, labelNilai = labelNilai, labelSub = labelSub
    )

    @Test
    fun `nilai dari gateway dipakai apa adanya`() {
        assertEquals("Rp5rb" to "potongan", nilaiKartu(v()))
    }

    @Test
    fun `gateway lama tanpa label tetap punya teks`() {
        assertEquals("%" to "potongan", nilaiKartu(v(jenis = "persen", labelNilai = null, labelSub = null)))
        assertEquals("Gratis" to "voucher", nilaiKartu(v(jenis = "gratis_item", labelNilai = null, labelSub = null)))
        assertEquals("Promo" to "voucher", nilaiKartu(v(jenis = "jenis_baru", labelNilai = null, labelSub = null)))
    }

    @Test
    fun `warna mengikuti jenis, pudar bila belum berlaku`() {
        assertEquals(WarnaKartu.ORANYE, warnaKartu(v(jenis = "nominal")))
        assertEquals(WarnaKartu.ORANYE, warnaKartu(v(jenis = "harga_spesial")))
        assertEquals(WarnaKartu.COKELAT, warnaKartu(v(jenis = "persen")))
        assertEquals(WarnaKartu.HIJAU, warnaKartu(v(jenis = "gratis_item")))
        assertEquals(WarnaKartu.HIJAU, warnaKartu(v(jenis = "beli_x_gratis_y")))
        assertEquals(WarnaKartu.PUDAR, warnaKartu(v(jenis = "gratis_item", status = "belum")))
    }

    @Test
    fun `masa berlaku dibaca dalam WIB`() {
        // 30 Sep 16:59:59 UTC = 30 Sep 23:59:59 WIB
        assertEquals("s.d. 30 Sep", labelBerlakuSampai("2026-09-30T16:59:59+00:00"))
        // 30 Sep 18:00 UTC = 1 Okt 01:00 WIB
        assertEquals("s.d. 1 Okt", labelBerlakuSampai("2026-09-30T18:00:00Z"))
        assertEquals("s.d. 30 Sep", labelBerlakuSampai("2026-09-30T08:50:00+07:00"))
    }

    @Test
    fun `tanpa tanggal atau tanggal rusak tidak menampilkan apa-apa`() {
        assertNull(labelBerlakuSampai(null))
        assertNull(labelBerlakuSampai("bukan-tanggal"))
    }

    @Test
    fun `tanggal tidak diulang di kalimat syarat`() {
        assertEquals("Potongan Rp5.000", syaratTanpaTanggal("Potongan Rp5.000 · s.d. 30 Sep", "s.d. 30 Sep"))
        assertEquals("", syaratTanpaTanggal("s.d. 30 Sep", "s.d. 30 Sep"))
        // Tanggal berbeda (atau tanpa tanggal) -> kalimat utuh.
        assertEquals("Potongan Rp5.000 · s.d. 30 Sep", syaratTanpaTanggal("Potongan Rp5.000 · s.d. 30 Sep", "s.d. 1 Okt"))
        assertEquals("Potongan Rp5.000", syaratTanpaTanggal("Potongan Rp5.000", null))
    }
}
