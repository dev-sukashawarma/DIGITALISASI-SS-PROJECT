package com.sukashawarma.customer.ui.screens.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OutletStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.data.api.OutletDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CatalogState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val outlet: OutletDto? = null,
    val kueri: String = "",
    val semuaItem: List<MenuItemDto> = emptyList(),
    val kategori: List<KategoriMenu> = emptyList(),
    /** Tidak ada outlet tersimpan dan tidak bisa ditentukan sendiri. */
    val perluPilihOutlet: Boolean = false,
    /** Tidak ada satu pun outlet yang ikut serta di aplikasi. */
    val tidakAdaOutlet: Boolean = false,
    /** Keranjang terhapus karena pelanggan berpindah outlet. */
    val keranjangDikosongkan: Boolean = false
)

class CatalogViewModel(
    private val repository: Repository,
    private val outletStore: OutletStore,
    private val cart: CartStore
) : ViewModel() {

    private val _state = MutableStateFlow(CatalogState())
    val state: StateFlow<CatalogState> = _state.asStateFlow()

    init {
        muat()
    }

    fun muat() {
        _state.value = _state.value.copy(memuat = true, galat = null)
        viewModelScope.launch {
            when (val hasil = repository.outlets()) {
                is GatewayResult.Gagal -> {
                    _state.value = _state.value.copy(memuat = false, galat = hasil.error)
                }
                is GatewayResult.Sukses -> {
                    val outlets = hasil.data
                    if (outlets.isEmpty()) {
                        _state.value = _state.value.copy(
                            memuat = false,
                            tidakAdaOutlet = true
                        )
                        return@launch
                    }

                    // Outlet tersimpan yang sudah dicabut dari aplikasi tidak
                    // boleh tetap dipakai: pelanggan akan melihat menu outlet
                    // yang tak lagi melayani pesanan aplikasi.
                    val tersimpan = outletStore.idTerpilih()
                    val terpilih = outlets.firstOrNull { it.id == tersimpan }
                        ?: outlets.singleOrNull()

                    if (terpilih == null) {
                        _state.value = _state.value.copy(
                            memuat = false,
                            perluPilihOutlet = true
                        )
                        return@launch
                    }

                    outletStore.simpan(terpilih.id, terpilih.name)
                    pasangOutletKeKeranjang(terpilih.id)
                    muatKatalog(terpilih)
                }
            }
        }
    }

    fun pilihOutlet(outlet: OutletDto) {
        outletStore.simpan(outlet.id, outlet.name)
        pasangOutletKeKeranjang(outlet.id)
        _state.value = _state.value.copy(
            memuat = true,
            galat = null,
            perluPilihOutlet = false,
            outlet = outlet,
            semuaItem = emptyList(),
            kategori = emptyList()
        )
        viewModelScope.launch { muatKatalog(outlet) }
    }

    fun akuiKeranjangDikosongkan() {
        _state.value = _state.value.copy(keranjangDikosongkan = false)
    }

    /**
     * `menu_item_id` bersifat per-outlet, jadi keranjang milik outlet lain
     * pasti ditolak gateway saat checkout. Mengosongkannya di sini -- saat
     * pelanggan masih di katalog dan bisa memesan ulang -- jauh lebih baik
     * daripada membiarkannya gagal di titik pembayaran.
     */
    private fun pasangOutletKeKeranjang(outletId: String) {
        if (cart.pakaiOutlet(outletId)) {
            _state.value = _state.value.copy(keranjangDikosongkan = true)
        }
    }

    fun ubahKueri(kueri: String) {
        val s = _state.value
        _state.value = s.copy(
            kueri = kueri,
            kategori = kelompokkanPerKategori(saringPencarian(s.semuaItem, kueri))
        )
    }

    private suspend fun muatKatalog(outlet: OutletDto) {
        when (val hasil = repository.katalog(outlet.id)) {
            is GatewayResult.Gagal -> {
                // Outlet tetap dipasang walau katalog gagal: kepala layar dan
                // tombol "Ganti" harus tetap bisa dipakai, kalau tidak
                // pelanggan terjebak di layar galat tanpa jalan keluar.
                _state.value = _state.value.copy(
                    memuat = false,
                    outlet = outlet,
                    galat = hasil.error
                )
            }
            is GatewayResult.Sukses -> {
                val kueri = _state.value.kueri
                _state.value = _state.value.copy(
                    memuat = false,
                    galat = null,
                    outlet = outlet,
                    semuaItem = hasil.data,
                    kategori = kelompokkanPerKategori(saringPencarian(hasil.data, kueri))
                )
            }
        }
    }
}
