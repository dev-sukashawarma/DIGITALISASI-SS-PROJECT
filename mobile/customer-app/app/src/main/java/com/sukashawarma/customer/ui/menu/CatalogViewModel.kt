package com.sukashawarma.customer.ui.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OutletStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.BannerDto
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.data.api.OutletDto
import com.sukashawarma.customer.ui.components.BottomNavTab
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class CatalogScrollEvent { KeAtas, KeMenu }

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
    val keranjangDikosongkan: Boolean = false,
    val bannerCarousel: List<BannerDto> = emptyList(),
    val bannerPopup: BannerDto? = null
)

class CatalogViewModel(
    private val repository: Repository,
    private val outletStore: OutletStore,
    private val cart: CartStore
) : ViewModel() {

    private val _state = MutableStateFlow(CatalogState())
    val state: StateFlow<CatalogState> = _state.asStateFlow()

    private val _eventScroll = MutableSharedFlow<CatalogScrollEvent>(extraBufferCapacity = 1)
    val eventScroll: SharedFlow<CatalogScrollEvent> = _eventScroll.asSharedFlow()

    private val _activeTab = MutableStateFlow(BottomNavTab.BERANDA)
    val activeTab: StateFlow<BottomNavTab> = _activeTab.asStateFlow()

    fun setTab(tab: BottomNavTab) {
        _activeTab.value = tab
        when (tab) {
            BottomNavTab.BERANDA -> _eventScroll.tryEmit(CatalogScrollEvent.KeAtas)
            BottomNavTab.MENU -> _eventScroll.tryEmit(CatalogScrollEvent.KeMenu)
            else -> {}
        }
    }

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
                    // Banner tidak boleh menjatuhkan Beranda ATAU menahannya:
                    // gagal memuatnya berarti tidak ada banner, bukan layar
                    // galat, dan lambat memuatnya tidak boleh membuat seluruh
                    // layar menunggu -- dijalankan di coroutine terpisah
                    // (bukan di-await di jalur ini) supaya katalog, isi utama
                    // halaman ini, tidak duduk di spinner menunggu banner.
                    viewModelScope.launch {
                        val banner = repository.banners()
                        if (banner is GatewayResult.Sukses) {
                            _state.value = _state.value.copy(
                                bannerCarousel = banner.data.carousel,
                                bannerPopup = banner.data.popup
                            )
                        }
                    }

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
