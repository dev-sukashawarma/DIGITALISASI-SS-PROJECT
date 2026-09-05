package com.sukashawarma.customer.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Batas jumlah per baris. Cerminan `JUMLAH_MAKS_PER_ITEM` di gateway. */
const val JUMLAH_MAKS_PER_ITEM = 99

/** Batas panjang catatan. Gateway memotong di angka yang sama. */
const val PANJANG_MAKS_CATATAN = 200

@Serializable
data class CartLine(
    val menuItemId: String,
    val nama: String,
    /**
     * Rupiah penuh. Rupiah tidak punya satuan pecahan, dan gateway
     * membandingkan `unit_price` dengan katalog memakai kesamaan PERSIS.
     * Menyimpannya sebagai Double akan membuka celah galat pembulatan tepat
     * di titik yang paling tidak boleh meleset.
     */
    val hargaSatuan: Long,
    val jumlah: Int,
    val catatan: String? = null
)

@Serializable
private data class IsiKeranjang(
    val outletId: String? = null,
    val baris: List<CartLine> = emptyList()
)

/** Cara keranjang bertahan lintas proses. Dipisah supaya bisa diuji tanpa Android. */
interface CartPersistence {
    fun muat(): String?
    fun simpan(isi: String)
}

/**
 * Keranjang pelanggan.
 *
 * **Kenapa bukan DataStore** (rencana menyebut DataStore): antarmuka yang
 * rencana itu sendiri tentukan bersifat sinkron (`isi(): List<CartLine>`,
 * `subtotal(): Long`), sedangkan DataStore seluruhnya asinkron. Membungkus
 * DataStore di balik pemanggilan sinkron berarti memblokir thread utama atau
 * menyimpan salinan bayangan di memori -- dua-duanya lebih buruk daripada
 * SharedPreferences, yang memang dirancang untuk data sekecil ini dan sudah
 * sinkron sejak awal. Keranjang tetap bertahan lintas proses, sesuai §5.4.
 */
class CartStore internal constructor(private val penyimpan: CartPersistence?) {

    private val json = Json { ignoreUnknownKeys = true }
    private var isi: IsiKeranjang = muatAwal()

    private fun muatAwal(): IsiKeranjang {
        val mentah = penyimpan?.muat() ?: return IsiKeranjang()
        // Keranjang rusak tidak boleh mematikan aplikasi saat dibuka. Lebih
        // baik keranjang kosong daripada layar yang tidak pernah muncul.
        return runCatching { json.decodeFromString<IsiKeranjang>(mentah) }
            .getOrElse { IsiKeranjang() }
    }

    private fun tulis() {
        penyimpan?.simpan(json.encodeToString(isi))
    }

    fun outletId(): String? = isi.outletId

    /**
     * Menetapkan outlet keranjang.
     *
     * Berpindah outlet MENGOSONGKAN keranjang, dan mengembalikan `true` bila
     * itu terjadi supaya layar bisa memberi tahu. `menu_item_id` bersifat
     * per-outlet (katalog disaring `outlet_id`), jadi membawa isi keranjang
     * outlet A ke outlet B menghasilkan pesanan yang PASTI ditolak gateway
     * dengan "tidak_ada" -- tepat di titik pembayaran, bukan di sini.
     */
    fun pakaiOutlet(outletId: String): Boolean {
        if (isi.outletId == outletId) return false
        val adaIsi = isi.baris.isNotEmpty()
        isi = IsiKeranjang(outletId = outletId, baris = emptyList())
        tulis()
        return adaIsi
    }

    /**
     * Menambahkan item.
     *
     * Baris digabung hanya bila id DAN catatannya sama. Catatan berbeda =
     * instruksi dapur berbeda, jadi harus jadi baris sendiri; menggabungkannya
     * akan membuat salah satu catatan hilang diam-diam.
     */
    fun tambah(
        menuItemId: String,
        nama: String,
        hargaSatuan: Long,
        jumlah: Int,
        catatan: String?
    ) {
        val catatanBersih = rapikanCatatan(catatan)
        val tambahan = jumlah.coerceIn(1, JUMLAH_MAKS_PER_ITEM)

        val baris = isi.baris.toMutableList()
        val posisi = baris.indexOfFirst {
            it.menuItemId == menuItemId && it.catatan == catatanBersih
        }

        if (posisi >= 0) {
            val lama = baris[posisi]
            baris[posisi] = lama.copy(
                jumlah = (lama.jumlah + tambahan).coerceAtMost(JUMLAH_MAKS_PER_ITEM)
            )
        } else {
            baris.add(
                CartLine(
                    menuItemId = menuItemId,
                    nama = nama,
                    hargaSatuan = hargaSatuan,
                    jumlah = tambahan,
                    catatan = catatanBersih
                )
            )
        }

        isi = isi.copy(baris = baris)
        tulis()
    }

    /** Menaikkan atau menurunkan jumlah. Turun sampai nol menghapus barisnya. */
    fun ubahJumlah(index: Int, delta: Int) {
        val baris = isi.baris.toMutableList()
        if (index !in baris.indices) return

        val baru = baris[index].jumlah + delta
        if (baru <= 0) {
            baris.removeAt(index)
        } else {
            baris[index] = baris[index].copy(
                jumlah = baru.coerceAtMost(JUMLAH_MAKS_PER_ITEM)
            )
        }

        isi = isi.copy(baris = baris)
        tulis()
    }

    fun hapus(index: Int) {
        val baris = isi.baris.toMutableList()
        if (index !in baris.indices) return
        baris.removeAt(index)
        isi = isi.copy(baris = baris)
        tulis()
    }

    /**
     * Membuang semua baris untuk satu menu.
     *
     * Dipakai saat gateway melaporkan item habis atau sudah tidak ada. Satu
     * menu bisa menempati beberapa baris (catatan berbeda), jadi menghapus
     * berdasarkan indeks akan menyisakan sebagian -- dan checkout gagal lagi
     * dengan keluhan yang sama persis.
     */
    fun hapusMenuItem(menuItemId: String) {
        isi = isi.copy(baris = isi.baris.filterNot { it.menuItemId == menuItemId })
        tulis()
    }

    /**
     * Menyetel harga satu menu ke harga terbaru dari gateway.
     *
     * Menerima harga baru adalah keputusan pelanggan, bukan sesuatu yang boleh
     * terjadi diam-diam: aplikasi memanggil ini hanya setelah harga barunya
     * ditampilkan dan pelanggan menekan tombolnya sendiri.
     */
    fun perbaruiHarga(menuItemId: String, hargaBaru: Long) {
        isi = isi.copy(
            baris = isi.baris.map {
                if (it.menuItemId == menuItemId) it.copy(hargaSatuan = hargaBaru) else it
            }
        )
        tulis()
    }

    fun isi(): List<CartLine> = isi.baris

    fun kosongkan() {
        isi = isi.copy(baris = emptyList())
        tulis()
    }

    fun subtotal(): Long = isi.baris.sumOf { it.hargaSatuan * it.jumlah }

    fun jumlahPorsi(): Int = isi.baris.sumOf { it.jumlah }

    companion object {
        /** Keranjang tanpa penyimpanan. Untuk test. */
        fun diMemori(): CartStore = CartStore(null)

        fun persisten(context: Context): CartStore =
            CartStore(PrefsCartPersistence(context.applicationContext))
    }
}

/**
 * Memotong catatan di 200 karakter DI APLIKASI, bukan hanya di gateway.
 *
 * Gateway juga memotongnya, tapi memotong lebih awal berarti pelanggan
 * melihat batasnya sendiri -- bukan mengetik seratus karakter lagi lalu
 * kehilangannya tanpa pernah diberi tahu.
 *
 * `|NOTE|` dibuang karena konvensi struk dapur memakai penanda itu untuk
 * memisahkan nama item dari catatan; catatan yang memuatnya akan merusak
 * cetakan dapur. Gateway juga membersihkannya, ini lapisan kedua.
 */
fun rapikanCatatan(catatan: String?): String? {
    val bersih = catatan?.replace("|NOTE|", " ")?.trim()?.take(PANJANG_MAKS_CATATAN)
    return if (bersih.isNullOrBlank()) null else bersih
}

private class PrefsCartPersistence(context: Context) : CartPersistence {
    private val prefs = context.getSharedPreferences("suka_customer_cart", Context.MODE_PRIVATE)
    override fun muat(): String? = prefs.getString("isi", null)
    override fun simpan(isi: String) {
        prefs.edit().putString("isi", isi).apply()
    }
}
