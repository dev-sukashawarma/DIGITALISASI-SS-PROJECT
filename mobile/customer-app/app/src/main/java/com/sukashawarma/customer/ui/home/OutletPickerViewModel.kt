package com.sukashawarma.customer.ui.home

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

enum class StatusLokasi { MENCARI, AKTIF, TANPA_IZIN, TIDAK_TERSEDIA }

data class OutletPickerState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val kueri: String = "",
    val semua: List<OutletDto> = emptyList(),
    val tampil: List<OutletDto> = emptyList(),
    /** `null` = jarak tidak ditampilkan dan urutan jatuh ke alfabetis. */
    val posisi: Koordinat? = null,
    val statusLokasi: StatusLokasi = StatusLokasi.MENCARI
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

class OutletPickerViewModel(
    private val repository: Repository,
    private val lokasi: LokasiPelanggan
) : ViewModel() {

    private val _state = MutableStateFlow(OutletPickerState())
    val state: StateFlow<OutletPickerState> = _state.asStateFlow()

    init {
        muat()
        perbaruiLokasi()
    }

    /** Dipanggil saat layar dibuka, setelah izin dijawab, dan dari tombol lokasi. */
    fun perbaruiLokasi() {
        if (!lokasi.punyaIzin()) {
            _state.value = _state.value.copy(statusLokasi = StatusLokasi.TANPA_IZIN)
            return
        }
        _state.value = _state.value.copy(statusLokasi = StatusLokasi.MENCARI)
        viewModelScope.launch {
            val hasil = lokasi.ambil()
            // State dibaca SETELAH menunggu lokasi (bisa sampai 10 dtk): daftar
            // outlet mungkin selesai dimuat selama itu dan tidak boleh tertimpa.
            val s = _state.value
            _state.value = when (hasil) {
                is HasilLokasi.Ada -> urutUlang(
                    s.copy(posisi = hasil.koordinat, statusLokasi = StatusLokasi.AKTIF)
                )
                HasilLokasi.TanpaIzin -> s.copy(statusLokasi = StatusLokasi.TANPA_IZIN)
                // Posisi lama (kalau ada) dibiarkan: urutan yang sudah benar tidak dirusak.
                HasilLokasi.TidakTersedia -> s.copy(
                    statusLokasi = if (s.posisi != null) StatusLokasi.AKTIF else StatusLokasi.TIDAK_TERSEDIA
                )
            }
        }
    }

    /** Pelanggan kembali dari Pengaturan: izin mungkin baru saja diberikan di sana. */
    fun cekIzinUlang() {
        if (_state.value.statusLokasi == StatusLokasi.TANPA_IZIN && lokasi.punyaIzin()) perbaruiLokasi()
    }

    private fun urutUlang(s: OutletPickerState): OutletPickerState {
        val urut = urutkanOutlet(s.semua, s.posisi)
        return s.copy(semua = urut, tampil = saringOutlet(urut, s.kueri))
    }

    fun muat() {
        _state.value = _state.value.copy(memuat = true, galat = null)
        viewModelScope.launch {
            when (val hasil = repository.outlets()) {
                is GatewayResult.Gagal ->
                    _state.value = _state.value.copy(memuat = false, galat = hasil.error)
                is GatewayResult.Sukses -> {
                    _state.value = urutUlang(
                        _state.value.copy(memuat = false, galat = null, semua = hasil.data)
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
