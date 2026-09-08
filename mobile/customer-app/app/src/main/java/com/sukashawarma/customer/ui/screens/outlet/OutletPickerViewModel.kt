package com.sukashawarma.customer.ui.screens.outlet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.OutletDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OutletPickerState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val kueri: String = "",
    val semua: List<OutletDto> = emptyList(),
    val tampil: List<OutletDto> = emptyList()
)

/**
 * Menyaring outlet berdasarkan nama atau alamat.
 *
 * Fungsi murni, di luar ViewModel, supaya bisa diuji tanpa Android.
 */
fun saringOutlet(outlets: List<OutletDto>, kueri: String): List<OutletDto> {
    val bersih = kueri.trim().lowercase()
    if (bersih.isEmpty()) return outlets
    return outlets.filter {
        it.name.lowercase().contains(bersih) ||
            (it.address?.lowercase()?.contains(bersih) == true)
    }
}

/**
 * Mengurutkan outlet: yang buka di atas, lalu alfabetis.
 *
 * Artboard mengurutkan berdasarkan jarak. Gateway tidak mengirim koordinat
 * pelanggan dan aplikasi belum meminta izin lokasi, jadi jarak tidak dihitung
 * di sini sama sekali -- bukan diisi angka perkiraan.
 */
fun urutkanOutlet(outlets: List<OutletDto>): List<OutletDto> =
    outlets.sortedWith(compareByDescending<OutletDto> { it.isActive }.thenBy { it.name.lowercase() })

class OutletPickerViewModel(private val repository: Repository) : ViewModel() {

    private val _state = MutableStateFlow(OutletPickerState())
    val state: StateFlow<OutletPickerState> = _state.asStateFlow()

    init {
        muat()
    }

    fun muat() {
        _state.value = _state.value.copy(memuat = true, galat = null)
        viewModelScope.launch {
            when (val hasil = repository.outlets()) {
                is GatewayResult.Gagal ->
                    _state.value = _state.value.copy(memuat = false, galat = hasil.error)
                is GatewayResult.Sukses -> {
                    val urut = urutkanOutlet(hasil.data)
                    _state.value = _state.value.copy(
                        memuat = false,
                        galat = null,
                        semua = urut,
                        tampil = saringOutlet(urut, _state.value.kueri)
                    )
                }
            }
        }
    }

    fun ubahKueri(kueri: String) {
        _state.value = _state.value.copy(
            kueri = kueri,
            tampil = saringOutlet(_state.value.semua, kueri)
        )
    }
}
