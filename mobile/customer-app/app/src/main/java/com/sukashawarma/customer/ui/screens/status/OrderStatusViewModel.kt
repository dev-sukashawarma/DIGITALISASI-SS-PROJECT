package com.sukashawarma.customer.ui.screens.status

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.OrderDetailDto
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Jeda penyegaran status selama pesanan masih berjalan. */
private const val JEDA_SEGARKAN_MS = 10_000L

data class OrderStatusState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val pesanan: OrderDetailDto? = null
)

class OrderStatusViewModel(
    private val repository: Repository,
    private val orderId: String
) : ViewModel() {

    private val _state = MutableStateFlow(OrderStatusState())
    val state: StateFlow<OrderStatusState> = _state.asStateFlow()

    init {
        pantau()
    }

    fun muat() {
        viewModelScope.launch { ambil() }
    }

    /**
     * Menyegarkan status selama pesanan masih berjalan.
     *
     * Berhenti sendiri begitu pesanan selesai atau dibatalkan -- memanggil
     * gateway tiap sepuluh detik untuk pesanan yang sudah tuntas hanya
     * membuang baterai pelanggan dan beban server.
     */
    private fun pantau() {
        viewModelScope.launch {
            while (true) {
                ambil()
                val tampil = tampilanStatus(_state.value.pesanan?.statusDapur)
                if (tampil.selesai || tampil.dibatalkan) return@launch
                delay(JEDA_SEGARKAN_MS)
            }
        }
    }

    private suspend fun ambil() {
        when (val hasil = repository.statusPesanan(orderId)) {
            is GatewayResult.Sukses ->
                _state.value = OrderStatusState(memuat = false, pesanan = hasil.data)
            is GatewayResult.Gagal ->
                // Data lama dipertahankan. Kehilangan sinyal sesaat tidak boleh
                // menghapus nomor pesanan dari layar pelanggan yang sedang
                // berdiri di depan kasir.
                _state.value = _state.value.copy(memuat = false, galat = hasil.error)
        }
    }
}
