package com.sukashawarma.customer.ui.screens.cart

import androidx.lifecycle.ViewModel
import com.sukashawarma.customer.data.CartLine
import com.sukashawarma.customer.data.CartStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class CartState(
    val baris: List<CartLine> = emptyList(),
    val subtotal: Long = 0,
    val porsi: Int = 0
)

/**
 * Jendela baca-tulis ke [CartStore].
 *
 * `CartStore` sengaja tetap sinkron dan tidak memancarkan aliran sendiri --
 * ia dipakai juga dari luar Compose (mis. saat outlet berganti). ViewModel
 * inilah yang menyegarkan tampilan setelah setiap perubahan, lewat [segarkan].
 * Satu ViewModel dipakai bersama seluruh layar supaya tidak ada dua salinan
 * keranjang yang saling menyimpang.
 */
class CartViewModel(private val cart: CartStore) : ViewModel() {

    private val _state = MutableStateFlow(baca())
    val state: StateFlow<CartState> = _state.asStateFlow()

    private fun baca() = CartState(
        baris = cart.isi(),
        subtotal = cart.subtotal(),
        porsi = cart.jumlahPorsi()
    )

    fun segarkan() {
        _state.value = baca()
    }

    fun tambah(menuItemId: String, nama: String, hargaSatuan: Long, jumlah: Int, catatan: String?) {
        cart.tambah(menuItemId, nama, hargaSatuan, jumlah, catatan)
        segarkan()
    }

    fun ubahJumlah(index: Int, delta: Int) {
        cart.ubahJumlah(index, delta)
        segarkan()
    }

    fun hapus(index: Int) {
        cart.hapus(index)
        segarkan()
    }

    fun kosongkan() {
        cart.kosongkan()
        segarkan()
    }
}
