package com.sukashawarma.customer.ui.screens.detail

import androidx.lifecycle.ViewModel
import com.sukashawarma.customer.data.JUMLAH_MAKS_PER_ITEM
import com.sukashawarma.customer.data.PANJANG_MAKS_CATATAN
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ItemDetailState(
    val jumlah: Int = 1,
    val catatan: String = ""
)

class ItemDetailViewModel : ViewModel() {

    private val _state = MutableStateFlow(ItemDetailState())
    val state: StateFlow<ItemDetailState> = _state.asStateFlow()

    fun ubahJumlah(delta: Int) {
        _state.value = _state.value.copy(
            jumlah = (_state.value.jumlah + delta).coerceIn(1, JUMLAH_MAKS_PER_ITEM)
        )
    }

    /**
     * Catatan dipotong SAAT DIKETIK, bukan saat disimpan. Pelanggan melihat
     * batasnya sendiri alih-alih mengetik terus lalu kehilangan sisanya.
     */
    fun ubahCatatan(teks: String) {
        _state.value = _state.value.copy(catatan = teks.take(PANJANG_MAKS_CATATAN))
    }
}
