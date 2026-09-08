package com.sukashawarma.customer.ui.screens.payment

import com.sukashawarma.customer.data.api.GatewayError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class IdempotensiTest {

    private val lama = "9197d153-2a29-4ca8-a123-a4a6ff8e1cbf"

    @Test
    fun `pesanan_kadaluarsa WAJIB menghasilkan client_order_id baru`() {
        val baru = idBerikutnya(lama, GatewayError.Kode("pesanan_kadaluarsa", "kedaluwarsa"))
        assertNotEquals(lama, baru)
    }

    @Test
    fun `pesanan_sedang_diproses WAJIB memakai id yang SAMA`() {
        val baru = idBerikutnya(lama, GatewayError.Kode("pesanan_sedang_diproses", "tunggu"))
        assertEquals(lama, baru)
    }

    @Test
    fun `galat jaringan memakai id yang sama - percobaan ulang harus idempoten`() {
        assertEquals(lama, idBerikutnya(lama, GatewayError.Jaringan(RuntimeException())))
    }

    @Test
    fun `galat server memakai id yang sama`() {
        assertEquals(lama, idBerikutnya(lama, GatewayError.Server(500)))
    }

    @Test
    fun `sesi tidak sah memakai id yang sama`() {
        // Pelanggan masuk lagi lalu mencoba ulang. Kalau idnya berganti,
        // percobaan pertama yang mungkin sudah membuat tagihan akan menjadi
        // tagihan kedua yang berdiri sendiri.
        assertEquals(lama, idBerikutnya(lama, GatewayError.SesiTidakSah))
    }

    @Test
    fun `keranjang_berubah memakai id yang sama`() {
        // Draftnya belum tentu terbuat; kalaupun terbuat, ia masih hidup.
        // Id baru di sini berisiko menghasilkan tagihan kedua.
        assertEquals(lama, idBerikutnya(lama, GatewayError.Kode("keranjang_berubah", "berubah")))
    }

    @Test
    fun `kode galat yang tidak dikenal memakai id yang sama`() {
        // Bawaan yang aman: gateway boleh menambah kode baru kapan saja, dan
        // yang paling berbahaya adalah menebak bahwa kode asing berarti
        // "buat id baru" lalu menagih pelanggan dua kali.
        assertEquals(lama, idBerikutnya(lama, GatewayError.Kode("kode_baru", "entah")))
    }

    @Test
    fun `id pesanan baru selalu berbeda`() {
        assertNotEquals(idPesananBaru(), idPesananBaru())
    }
}
