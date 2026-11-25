package com.sukashawarma.customer.ui.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartLine
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.CartTopping
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class CartState(
    val baris: List<CartLine> = emptyList(),
    val subtotal: Long = 0,
    val porsi: Int = 0
)

/**
 * Jendela baca-tulis ke [CartStore].
 *
 * Kini reaktif langsung terhadap [CartStore.snapshot] sehingga setiap perubahan
 * (termasuk dari Checkout `perbaiki()`, pergantian outlet otomatis, logout, atau
 * pembayaran lunas) otomatis tercermin tanpa risiko index-shift akibat lupa
 * memanggil `segarkan()`.
 */
class CartViewModel(private val cart: CartStore) : ViewModel() {

    val state: StateFlow<CartState> = cart.snapshot
        .map { snap -> CartState(baris = snap.baris, subtotal = snap.subtotal, porsi = snap.porsi) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.Eagerly,
            initialValue = CartState(
                baris = cart.isi(),
                subtotal = cart.subtotal(),
                porsi = cart.jumlahPorsi()
            )
        )

    /** Dipertahankan untuk kompatibilitas pemanggil; [state] sudah selalu segar otomatis. */
    fun segarkan() = Unit

    fun tambah(
        menuItemId: String,
        nama: String,
        hargaSatuan: Long,
        jumlah: Int,
        catatan: String?,
        toppings: List<CartTopping> = emptyList()
    ) {
        cart.tambah(menuItemId, nama, hargaSatuan, jumlah, catatan, toppings)
    }

    fun hapusTopping(index: Int, toppingMenuItemId: String) {
        cart.hapusTopping(index, toppingMenuItemId)
    }

    fun ubahJumlah(index: Int, delta: Int) {
        cart.ubahJumlah(index, delta)
    }

    fun hapus(index: Int) {
        cart.hapus(index)
    }

    fun kosongkan() {
        cart.kosongkan()
    }
}
