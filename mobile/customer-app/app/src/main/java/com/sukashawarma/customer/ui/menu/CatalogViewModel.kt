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
import com.sukashawarma.customer.ui.home.HasilLokasi
import com.sukashawarma.customer.ui.home.LokasiPelanggan
import com.sukashawarma.customer.ui.home.bolehPesan
import com.sukashawarma.customer.ui.home.urutkanOutlet
import kotlinx.coroutines.Job
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
    /**
     * Outlet ditampilkan otomatis sebagai fallback agar Beranda langsung terbuka
     * tanpa mencegat pengguna baru di layar Pilih Outlet. Dipakai untuk menampilkan
     * strip pengingat ringan di Beranda dan konfirmasi 1x sebelum bayar agar tidak
     * salah cabang.
     */
    val outletOtomatis: Boolean = false,
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
    private val cart: CartStore,
    private val lokasi: LokasiPelanggan? = null,
    muatAwal: Boolean = true
) : ViewModel() {

    private val _state = MutableStateFlow(CatalogState())
    val state: StateFlow<CatalogState> = _state.asStateFlow()

    private val _eventScroll = MutableSharedFlow<CatalogScrollEvent>(extraBufferCapacity = 1)
    val eventScroll: SharedFlow<CatalogScrollEvent> = _eventScroll.asSharedFlow()

    private val _activeTab = MutableStateFlow(BottomNavTab.BERANDA)
    val activeTab: StateFlow<BottomNavTab> = _activeTab.asStateFlow()

    private var muatJob: Job? = null
    private var bannerJob: Job? = null

    fun setTab(tab: BottomNavTab) {
        _activeTab.value = tab
        when (tab) {
            BottomNavTab.BERANDA -> _eventScroll.tryEmit(CatalogScrollEvent.KeAtas)
            BottomNavTab.MENU -> _eventScroll.tryEmit(CatalogScrollEvent.KeMenu)
            else -> {}
        }
    }

    init {
        if (muatAwal) muat()
    }

    fun muat() {
        muatJob?.cancel()
        _state.value = _state.value.copy(
            memuat = true,
            galat = null,
            perluPilihOutlet = false,
            tidakAdaOutlet = false
        )
        muatJob = viewModelScope.launch {
            when (val hasil = repository.outlets()) {
                is GatewayResult.Gagal -> {
                    _state.value = _state.value.copy(memuat = false, galat = hasil.error)
                }
                is GatewayResult.Sukses -> {
                    bannerJob?.cancel()
                    bannerJob = viewModelScope.launch {
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

                    // Prioritas 1: outlet yang pernah dipilih pelanggan (dan masih aktif di app).
                    // Prioritas 2: hanya ada 1 outlet.
                    val tersimpan = outletStore.idTerpilih()
                    var terpilih = outlets.firstOrNull { it.id == tersimpan }
                        ?: outlets.singleOrNull()
                    var otomatis = false

                    // Prioritas 3: outlet buka terdekat bila izin lokasi sudah diberikan.
                    if (terpilih == null && lokasi != null && lokasi.punyaIzin()) {
                        val hasilLokasi = lokasi.ambil()
                        if (hasilLokasi is HasilLokasi.Ada) {
                            terpilih = urutkanOutlet(outlets, hasilLokasi.koordinat).firstOrNull()
                        }
                    }

                    // Prioritas 4 (onboarding tanpa cegat): pilih outlet buka pertama
                    // sebagai tampilan awal agar Beranda langsung terbuka penuh, sambil
                    // menandai `outletOtomatis = true` untuk konfirmasi ringan sebelum bayar.
                    if (terpilih == null) {
                        terpilih = outlets.firstOrNull { it.bolehPesan() } ?: outlets.first()
                        otomatis = true
                    }

                    if (!otomatis) {
                        outletStore.simpan(terpilih.id, terpilih.name)
                    }
                    pasangOutletKeKeranjang(terpilih.id)
                    _state.value = _state.value.copy(outletOtomatis = otomatis)
                    muatKatalog(terpilih)
                }
            }
        }
    }

    fun pilihOutlet(outlet: OutletDto) {
        muatJob?.cancel()
        outletStore.simpan(outlet.id, outlet.name)
        pasangOutletKeKeranjang(outlet.id)
        _state.value = _state.value.copy(
            memuat = true,
            galat = null,
            kueri = "",
            perluPilihOutlet = false,
            tidakAdaOutlet = false,
            outletOtomatis = false,
            outlet = outlet,
            semuaItem = emptyList(),
            kategori = emptyList()
        )
        muatJob = viewModelScope.launch { muatKatalog(outlet) }
    }

    /** Pelanggan mengonfirmasi outlet otomatis saat akan lanjut ke pembayaran. */
    fun konfirmasiOutletSaatIni() {
        val cur = _state.value.outlet ?: return
        outletStore.simpan(cur.id, cur.name)
        _state.value = _state.value.copy(outletOtomatis = false)
    }

    fun segarkanStatusOutlet() {
        if (_state.value.outlet == null) return
        viewModelScope.launch {
            val hasil = repository.outlets()
            if (hasil is GatewayResult.Sukses) {
                _state.value = _state.value.copy(
                    outlet = perbaruiOutlet(_state.value.outlet, hasil.data)
                )
            }
        }
    }

    fun akuiKeranjangDikosongkan() {
        _state.value = _state.value.copy(keranjangDikosongkan = false)
    }

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
                _state.value = _state.value.copy(
                    memuat = false,
                    outlet = outlet,
                    galat = hasil.error
                )
            }
            is GatewayResult.Sukses -> {
                val items = hasil.data
                _state.value = _state.value.copy(
                    memuat = false,
                    outlet = outlet,
                    semuaItem = items,
                    kategori = kelompokkanPerKategori(saringPencarian(items, _state.value.kueri))
                )
            }
        }
    }
}
