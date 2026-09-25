package com.sukashawarma.customer.data.api

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class VoucherDtoTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `request tanpa voucher tidak mengirim field voucher`() {
        val teks = json.encodeToString(CheckoutValidateRequest(outletId = "o1", items = emptyList()))
        assertFalse(teks.contains("voucher"))
    }

    @Test
    fun `blok voucher validate terbaca`() {
        val r = json.decodeFromString<CheckoutValidateResponse>(
            """{"ok":true,"subtotal":40000,"discountAmount":10000,"total":30000,
               "voucher":{"id":"v1","nama":"Uji","status":"berlaku","potongan":10000,
               "item_gratis":[{"menu_item_id":"M","name":"Es Teh","unit_price":10000,"quantity":1,"note":"Gratis voucher"}]}}"""
        )
        assertEquals("berlaku", r.voucher?.status)
        assertEquals("Es Teh", r.voucher?.itemGratis?.single()?.name)
    }

    @Test
    fun `daftar voucher terbaca`() {
        val r = json.decodeFromString<VouchersResponse>(
            """{"vouchers":[{"id":"v1","nama":"Uji","jenis":"persen","kalimat_syarat":"Potongan 10%","status":"belum","alasan":"Sudah kamu pakai"}]}"""
        )
        assertEquals("Sudah kamu pakai", r.vouchers.single().alasan)
    }
}
