package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CartStoreTest {

    private fun keranjang() = CartStore.diMemori()

    @Test
    fun `menambah item yang sama tanpa catatan menggabungkan jumlahnya`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, null)
        k.tambah("m1", "Shawarma Ayam Original", 25000, 2, null)
        assertEquals(1, k.isi().size)
        assertEquals(3, k.isi()[0].jumlah)
    }

    @Test
    fun `item sama dengan catatan berbeda adalah baris terpisah`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, null)
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, "Jangan pedas")
        assertEquals(2, k.isi().size)
    }

    @Test
    fun `mengurangi jumlah sampai nol menghapus barisnya`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 1, null)
        k.ubahJumlah(0, -1)
        assertEquals(0, k.isi().size)
    }

    @Test
    fun `jumlah tidak pernah melebihi 99 karena gateway menolaknya`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 99, null)
        k.ubahJumlah(0, 1)
        assertEquals(99, k.isi()[0].jumlah)
    }

    @Test
    fun `menggabungkan dua penambahan pun tidak melewati 99`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 60, null)
        k.tambah("m1", "Shawarma Ayam Original", 25000, 60, null)
        assertEquals(99, k.isi()[0].jumlah)
    }

    @Test
    fun `subtotal menjumlahkan harga kali jumlah`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma Ayam Original", 25000, 2, null)
        k.tambah("m2", "Es Teh Manis", 8000, 1, null)
        assertEquals(58000L, k.subtotal())
    }

    @Test
    fun `indeks di luar jangkauan diabaikan, bukan melempar`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, null)
        k.ubahJumlah(5, 1)
        k.hapus(-1)
        assertEquals(1, k.isi().size)
    }

    @Test
    fun `berpindah outlet mengosongkan keranjang dan mengabarkannya`() {
        // menu_item_id bersifat per-outlet. Membawa isi keranjang outlet A ke
        // outlet B menghasilkan penolakan gateway tepat di titik pembayaran.
        val k = keranjang()
        k.pakaiOutlet("outlet-a")
        k.tambah("m1", "Shawarma", 25000, 1, null)

        assertTrue(k.pakaiOutlet("outlet-b"))
        assertEquals(0, k.isi().size)
        assertEquals("outlet-b", k.outletId())
    }

    @Test
    fun `memilih outlet yang sama tidak mengosongkan apa pun`() {
        val k = keranjang()
        k.pakaiOutlet("outlet-a")
        k.tambah("m1", "Shawarma", 25000, 1, null)

        assertFalse(k.pakaiOutlet("outlet-a"))
        assertEquals(1, k.isi().size)
    }

    @Test
    fun `berpindah outlet dengan keranjang kosong tidak melapor terhapus`() {
        val k = keranjang()
        k.pakaiOutlet("outlet-a")
        assertFalse(k.pakaiOutlet("outlet-b"))
    }

    @Test
    fun `catatan dipotong 200 karakter di aplikasi`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, "x".repeat(500))
        assertEquals(200, k.isi()[0].catatan?.length)
    }

    @Test
    fun `catatan kosong disimpan sebagai null, bukan string kosong`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, "   ")
        assertNull(k.isi()[0].catatan)
    }

    @Test
    fun `catatan berisi penanda NOTE dibersihkan agar struk dapur tidak rusak`() {
        assertEquals("Jangan pedas", rapikanCatatan("|NOTE|Jangan pedas"))
    }

    @Test
    fun `keranjang bertahan lintas proses lewat penyimpanan`() {
        val simpanan = PenyimpanPalsu()
        val pertama = CartStore(simpanan)
        pertama.pakaiOutlet("outlet-a")
        pertama.tambah("m1", "Shawarma", 25000, 2, "Jangan pedas")

        val kedua = CartStore(simpanan)
        assertEquals(1, kedua.isi().size)
        assertEquals(2, kedua.isi()[0].jumlah)
        assertEquals("Jangan pedas", kedua.isi()[0].catatan)
        assertEquals("outlet-a", kedua.outletId())
    }

    @Test
    fun `penyimpanan rusak menghasilkan keranjang kosong, bukan crash`() {
        // Keranjang rusak tidak boleh mematikan aplikasi saat dibuka.
        val simpanan = PenyimpanPalsu().apply { isi = "{ bukan json" }
        assertEquals(0, CartStore(simpanan).isi().size)
    }

    private class PenyimpanPalsu : CartPersistence {
        var isi: String? = null
        override fun muat(): String? = isi
        override fun simpan(isi: String) {
            this.isi = isi
        }
    }
}
