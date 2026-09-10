package com.sukashawarma.customer.ui.notifications

import com.sukashawarma.customer.data.api.NotificationDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationFilterTest {

    private val notif1 = NotificationDto(
        id = "1",
        orderId = "order-123",
        type = "order_status",
        title = "Pesanan Diterima",
        body = "Sedang dimasak di dapur",
        isRead = false,
        createdAt = "2026-09-09T10:00:00Z"
    )

    private val notif2 = NotificationDto(
        id = "2",
        orderId = "order-123",
        type = "reminder",
        title = "Siap Diambil",
        body = "Pesanan #42 siap diambil",
        isRead = true,
        createdAt = "2026-09-09T10:30:00Z"
    )

    private val notif3 = NotificationDto(
        id = "3",
        orderId = null,
        type = "promo",
        title = "Diskon Hari Kemerdekaan",
        body = "Potongan 20% untuk shawarma sapi",
        isRead = false,
        createdAt = "2026-09-09T08:00:00Z"
    )

    private val notifList = listOf(notif1, notif2, notif3)

    @Test
    fun `tab SEMUA menampilkan seluruh notifikasi`() {
        val state = NotificationState(
            semuaNotifikasi = notifList,
            tabTerpilih = KategoriNotifikasi.SEMUA
        )
        assertEquals(3, state.notifikasiTampil.size)
    }

    @Test
    fun `tab PESANAN hanya memfilter order_status dan reminder`() {
        val state = NotificationState(
            semuaNotifikasi = notifList,
            tabTerpilih = KategoriNotifikasi.PESANAN
        )
        assertEquals(2, state.notifikasiTampil.size)
        assertTrue(state.notifikasiTampil.all { it.type == "order_status" || it.type == "reminder" })
    }

    @Test
    fun `tab PROMO hanya memfilter promo dan update sistem`() {
        val state = NotificationState(
            semuaNotifikasi = notifList,
            tabTerpilih = KategoriNotifikasi.PROMO
        )
        assertEquals(1, state.notifikasiTampil.size)
        assertEquals("3", state.notifikasiTampil[0].id)
    }

    @Test
    fun `unread count menghitung notifikasi yang belum dibaca`() {
        val unread = notifList.count { !it.isRead }
        assertEquals(2, unread)
    }
}
