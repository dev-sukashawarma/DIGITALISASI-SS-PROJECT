package com.sukashawarma.customer.ui.checkout

import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.VoucherCheckoutDto
import com.sukashawarma.customer.ui.payment.pesanBayar
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VoucherCheckoutTest {
    private val pilih = PilihanVoucher(id = "v1", nama = "Hemat")

    @Test
    fun `tanpa voucher tidak mengunci`() = assertNull(alasanKunciVoucher(null, null))

    @Test
    fun `voucher berlaku tidak mengunci`() =
        assertNull(alasanKunciVoucher(pilih, VoucherCheckoutDto(id = "v1", status = "berlaku", potongan = 5000.0)))

    @Test
    fun `voucher belum berlaku mengunci dengan alasan gateway`() =
        assertEquals("Kurang Rp12.000 lagi",
            alasanKunciVoucher(pilih, VoucherCheckoutDto(id = "v1", status = "belum", alasan = "Kurang Rp12.000 lagi")))

    @Test
    fun `voucher terpasang tapi gateway lama tidak mengirim blok`() =
        assertEquals("Voucher belum bisa dicek. Lepas voucher untuk melanjutkan.", alasanKunciVoucher(pilih, null))

    @Test
    fun `label potongan`() {
        assertEquals("Potongan voucher", labelPotonganVoucher(VoucherCheckoutDto(status = "berlaku")))
        assertEquals("Potongan Promo", labelPotonganVoucher(null))
    }

    @Test
    fun `pesan 409 voucher memakai kalimat gateway`() =
        assertEquals("Kuota voucher sudah habis",
            pesanBayar(GatewayError.Kode("voucher_tidak_berlaku", "Kuota voucher sudah habis")))

    // Pin gerbang `CheckoutState.bolehLanjut`: voucher terpasang tanpa blok
    // yang menyatakan "berlaku" HARUS mengunci Bayar, apa pun nilai `total`.
    // Bug yang dicegah: kondisi lama hanya melihat `total != null`, jadi
    // voucher yang belum/tidak dicek gateway bisa lolos ke pembayaran selama
    // total dari respons SEBELUMNYA (mis. tanpa voucher) masih tersimpan.

    @Test
    fun `bolehLanjut terkunci saat voucher terpasang tanpa blok`() {
        val state = CheckoutState(memuat = false, total = 50_000L, voucher = pilih, blokVoucher = null)
        assertFalse(state.bolehLanjut)
    }

    @Test
    fun `bolehLanjut terkunci saat voucher berstatus belum`() {
        val state = CheckoutState(
            memuat = false,
            total = 50_000L,
            voucher = pilih,
            blokVoucher = VoucherCheckoutDto(id = "v1", status = "belum", alasan = "Kurang Rp12.000 lagi")
        )
        assertFalse(state.bolehLanjut)
    }

    @Test
    fun `bolehLanjut terbuka saat blok voucher berlaku`() {
        val state = CheckoutState(
            memuat = false,
            total = 50_000L,
            voucher = pilih,
            blokVoucher = VoucherCheckoutDto(id = "v1", status = "berlaku", potongan = 5_000.0)
        )
        assertTrue(state.bolehLanjut)
    }
}
