package com.sukashawarma.customer.ui.screens.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.OrderDetailDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HistoryState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val pesanan: List<OrderDetailDto> = emptyList()
)

class HistoryViewModel(private val repository: Repository) : ViewModel() {

    private val _state = MutableStateFlow(HistoryState())
    val state: StateFlow<HistoryState> = _state.asStateFlow()

    init {
        muat()
    }

    fun muat() {
        _state.value = _state.value.copy(memuat = true, galat = null)
        viewModelScope.launch {
            when (val hasil = repository.riwayat()) {
                is GatewayResult.Sukses ->
                    _state.value = HistoryState(memuat = false, pesanan = hasil.data)
                is GatewayResult.Gagal ->
                    _state.value = _state.value.copy(memuat = false, galat = hasil.error)
            }
        }
    }
}
