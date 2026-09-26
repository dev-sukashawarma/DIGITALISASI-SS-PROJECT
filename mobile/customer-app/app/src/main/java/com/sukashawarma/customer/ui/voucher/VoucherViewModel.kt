package com.sukashawarma.customer.ui.voucher

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.VoucherDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VoucherState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val vouchers: List<VoucherDto> = emptyList()
)

class VoucherViewModel(
    private val muat: suspend () -> GatewayResult<List<VoucherDto>>,
    private val cart: CartStore
) : ViewModel() {

    private val _state = MutableStateFlow(VoucherState())
    val state: StateFlow<VoucherState> = _state.asStateFlow()

    init {
        muatUlang()
    }

    fun muatUlang() {
        _state.value = _state.value.copy(memuat = true, galat = null)
        viewModelScope.launch {
            _state.value = when (val hasil = muat()) {
                is GatewayResult.Sukses -> VoucherState(memuat = false, vouchers = hasil.data)
                is GatewayResult.Gagal -> _state.value.copy(memuat = false, galat = hasil.error)
            }
        }
    }

    /** Memasang voucher terpilih ke keranjang -- checkout yang memvalidasinya. */
    fun pakai(v: VoucherDto) {
        cart.pasangVoucher(PilihanVoucher(id = v.id, nama = v.nama))
    }
}
