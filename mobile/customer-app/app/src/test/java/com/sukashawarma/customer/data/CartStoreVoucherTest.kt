package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CartStoreVoucherTest {
    private class Memori : CartPersistence {
        var isi: String? = null
        override fun muat() = isi
        override fun simpan(isi: String) { this.isi = isi }
    }

    @Test
    fun `voucher bertahan lintas proses`() {
        val p = Memori()
        CartStore(p).pasangVoucher(PilihanVoucher(id = "v1", nama = "Hemat"))
        assertEquals(PilihanVoucher(id = "v1", nama = "Hemat"), CartStore(p).voucher())
    }

    @Test
    fun `kosongkan keranjang ikut melepas voucher`() {
        val c = CartStore(Memori())
        c.pasangVoucher(PilihanVoucher(kode = "HEMAT", nama = "HEMAT"))
        c.kosongkan()
        assertNull(c.voucher())
    }

    @Test
    fun `lepas voucher`() {
        val c = CartStore(Memori())
        c.pasangVoucher(PilihanVoucher(id = "v1", nama = "Hemat"))
        c.lepasVoucher()
        assertNull(c.voucher())
    }

    @Test
    fun `keranjang lama tanpa field voucher tetap terbaca`() {
        val p = Memori().apply { isi = """{"outletId":"o1","baris":[]}""" }
        assertNull(CartStore(p).voucher())
        assertEquals("o1", CartStore(p).outletId())
    }
}
