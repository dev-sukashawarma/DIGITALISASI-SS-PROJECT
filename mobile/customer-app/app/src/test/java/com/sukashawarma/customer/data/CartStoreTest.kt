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

    @Test
    fun `menghapus menu membuang SEMUA barisnya, bukan hanya yang pertama`() {
        // Satu menu bisa menempati beberapa baris karena catatannya berbeda.
        // Menyisakan salah satunya membuat checkout gagal lagi dengan keluhan
        // yang sama persis -- pelanggan menekan "Hapus" dan tidak terjadi apa-apa.
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, null)
        k.tambah("m1", "Shawarma", 25000, 1, "Jangan pedas")
        k.tambah("m2", "Es Teh", 8000, 1, null)

        k.hapusMenuItem("m1")

        assertEquals(1, k.isi().size)
        assertEquals("m2", k.isi()[0].menuItemId)
    }

    @Test
    fun `memperbarui harga mengenai semua baris menu itu`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, null)
        k.tambah("m1", "Shawarma", 25000, 2, "Jangan pedas")

        k.perbaruiHarga("m1", 28000)

        assertTrue(k.isi().all { it.hargaSatuan == 28000L })
        assertEquals(84000L, k.subtotal())
    }

    @Test
    fun `memperbarui harga tidak menyentuh menu lain`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, null)
        k.tambah("m2", "Es Teh", 8000, 1, null)

        k.perbaruiHarga("m1", 28000)

        assertEquals(8000L, k.isi().first { it.menuItemId == "m2" }.hargaSatuan)
    }

    @Test
    fun `menghapus menu yang tidak ada tidak mengubah apa pun`() {
        val k = keranjang()
        k.tambah("m1", "Shawarma", 25000, 1, null)
        k.hapusMenuItem("entah")
        assertEquals(1, k.isi().size)
    }

    @Test
    fun `menambah item dengan topping menyimpan sub-item dan menghitung subtotal gabungan`() {
        val k = keranjang()
        val toppings = listOf(
            CartTopping("top-keju", "Extra Keju", 7000),
            CartTopping("top-kentang", "Extra Kentang", 9000)
        )
        k.tambah("m1", "Shawarma Ayam", 25000, 2, null, toppings)

        assertEquals(1, k.isi().size)
        assertEquals(2, k.isi()[0].toppings.size)
        // (25.000 + 7.000 + 9.000) * 2 = 82.000
        assertEquals(82000L, k.subtotal())
    }

    @Test
    fun `menghapus topping dari baris mengurangi subtotal secara presisi`() {
        val k = keranjang()
        val toppings = listOf(
            CartTopping("top-keju", "Extra Keju", 7000),
            CartTopping("top-kentang", "Extra Kentang", 9000)
        )
        k.tambah("m1", "Shawarma Ayam", 25000, 1, null, toppings)
        assertEquals(41000L, k.subtotal())

        k.hapusTopping(0, "top-kentang")
        assertEquals(1, k.isi()[0].toppings.size)
        assertEquals("top-keju", k.isi()[0].toppings[0].menuItemId)
        // (25.000 + 7.000) * 1 = 32.000
        assertEquals(32000L, k.subtotal())
    }

    @Test
    fun `menambah item yang sama dengan topping yang sama menggabungkan jumlahnya`() {
        val k = keranjang()
        val toppings = listOf(CartTopping("top-keju", "Extra Keju", 7000))
        k.tambah("m1", "Shawarma", 25000, 1, null, toppings)
        k.tambah("m1", "Shawarma", 25000, 2, null, toppings)

        assertEquals(1, k.isi().size)
        assertEquals(3, k.isi()[0].jumlah)
        assertEquals(1, k.isi()[0].toppings.size)
        assertEquals(96000L, k.subtotal())
    }

    @Test
    fun `menambah item yang sama dengan topping berbeda menjadi baris terpisah`() {
        val k = keranjang()
        val top1 = listOf(CartTopping("top-keju", "Extra Keju", 7000))
        val top2 = listOf(CartTopping("top-kentang", "Extra Kentang", 9000))
        k.tambah("m1", "Shawarma", 25000, 1, null, top1)
        k.tambah("m1", "Shawarma", 25000, 1, null, top2)

        assertEquals(2, k.isi().size)
        assertEquals("top-keju", k.isi()[0].toppings[0].menuItemId)
        assertEquals("top-kentang", k.isi()[1].toppings[0].menuItemId)
    }

    @Test
    fun `hapusMenuItem menghapus sub-item topping yang cocok dari baris pesanan`() {
        val k = keranjang()
        val toppings = listOf(CartTopping("top-keju", "Extra Keju", 7000))
        k.tambah("m1", "Shawarma", 25000, 1, null, toppings)

        k.hapusMenuItem("top-keju")
        assertEquals(1, k.isi().size)
        assertEquals(0, k.isi()[0].toppings.size)
        assertEquals(25000L, k.subtotal())
    }

    private class PenyimpanPalsu : CartPersistence {
        var isi: String? = null
        override fun muat(): String? = isi
        override fun simpan(isi: String) {
            this.isi = isi
        }
    }
}
