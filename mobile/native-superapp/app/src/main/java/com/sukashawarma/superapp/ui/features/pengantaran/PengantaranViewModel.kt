package com.sukashawarma.superapp.ui.features.pengantaran

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class LayarPengantaran { Memuat, PerluIzin, PilihMuatan, SusunUrutan, DalamPerjalanan, Ringkasan }

data class Posisi(val lat: Double, val lng: Double, val akurasiM: Float?)

fun interface SumberLokasi {
    suspend fun posisi(): Posisi?
}

interface KendaliService {
    fun mulai(pengaturan: Pengaturan, tiba: Int, total: Int)
    fun perbarui(tiba: Int, total: Int)
    fun hentikan()
}

data class PengantaranState(
    val layar: LayarPengantaran = LayarPengantaran.Memuat,
    val sjSiap: List<SjSiap> = emptyList(),
    val dipilih: Set<String> = emptySet(),
    val urutan: List<SjSiap> = emptyList(),
    val perjalanan: PerjalananUi? = null,
    val ringkasan: RingkasanPerjalanan? = null,
    val pesan: String? = null,
    val sibuk: Boolean = false,
    val konfirmasiSelesai: Boolean = false,
)

private fun PerjalananUi.tibaCount() = stops.count { it.status != "menunggu" }
private fun PerjalananUi.adaMenunggu() = stops.any { it.status == "menunggu" }

/** Pesan galat ringkas dari RPC (baris pertama pesan Postgres). */
internal fun pesanGalat(e: Throwable): String =
    e.message?.lineSequence()?.firstOrNull { it.isNotBlank() }?.trim() ?: "Terjadi kesalahan, coba lagi"

/**
 * Alur layar Pengantaran. Semua aksi `suspend` supaya bisa diuji tanpa Android;
 * UI memanggilnya lewat coroutine scope Compose.
 */
class PengantaranViewModel(
    private val api: PengantaranApi,
    private val lokasi: SumberLokasi,
    private val service: KendaliService,
    private val punyaIzinLokasi: () -> Boolean,
) {
    private val _state = MutableStateFlow(PengantaranState())
    val state: StateFlow<PengantaranState> = _state.asStateFlow()

    private suspend fun aman(blok: suspend () -> Unit) {
        _state.update { it.copy(sibuk = true, pesan = null) }
        try {
            blok()
        } catch (e: Exception) {
            _state.update { it.copy(pesan = pesanGalat(e)) }
        } finally {
            _state.update { it.copy(sibuk = false) }
        }
    }

    suspend fun muat() {
        if (!punyaIzinLokasi()) {
            _state.update { it.copy(layar = LayarPengantaran.PerluIzin) }
            return
        }
        aman {
            val aktif = api.perjalananAktif()
            if (aktif != null) {
                _state.update { it.copy(layar = LayarPengantaran.DalamPerjalanan, perjalanan = aktif, konfirmasiSelesai = false) }
                service.mulai(aktif.pengaturan, aktif.tibaCount(), aktif.stops.size)
            } else {
                val siap = api.sjSiap()
                _state.update {
                    it.copy(layar = LayarPengantaran.PilihMuatan, sjSiap = siap,
                        dipilih = it.dipilih.filter { id -> siap.any { s -> s.suratJalanId == id } }.toSet())
                }
            }
        }
    }

    fun pilih(sjId: String) = _state.update {
        it.copy(dipilih = if (sjId in it.dipilih) it.dipilih - sjId else it.dipilih + sjId, pesan = null)
    }

    suspend fun lanjutUrutan() {
        val s = _state.value
        if (s.dipilih.isEmpty()) {
            _state.update { it.copy(pesan = "Pilih minimal satu surat jalan") }
            return
        }
        val terpilih = s.sjSiap.filter { it.suratJalanId in s.dipilih }
        val pos = runCatching { lokasi.posisi() }.getOrNull()
        val urutan = if (pos != null) UsulanUrutan.susun(pos.lat, pos.lng, terpilih) else terpilih
        _state.update { it.copy(layar = LayarPengantaran.SusunUrutan, urutan = urutan, pesan = null) }
    }

    fun pindah(dari: Int, ke: Int) = _state.update {
        if (dari !in it.urutan.indices || ke !in it.urutan.indices) it
        else it.copy(urutan = it.urutan.toMutableList().apply { add(ke, removeAt(dari)) })
    }

    fun kembaliKePilih() = _state.update { it.copy(layar = LayarPengantaran.PilihMuatan, pesan = null) }

    suspend fun berangkat() {
        val urutan = _state.value.urutan
        _state.update { it.copy(sibuk = true, pesan = null) }
        try {
            val pos = lokasi.posisi() ?: throw IllegalStateException("Lokasi belum didapat. Pastikan GPS menyala.")
            api.mulai(urutan.map { it.suratJalanId }, pos.lat, pos.lng)
            val aktif = api.perjalananAktif() ?: throw IllegalStateException("Perjalanan tidak ditemukan setelah berangkat")
            _state.update { it.copy(layar = LayarPengantaran.DalamPerjalanan, perjalanan = aktif, dipilih = emptySet()) }
            service.mulai(aktif.pengaturan, aktif.tibaCount(), aktif.stops.size)
        } catch (e: Exception) {
            // Perjalanan mungkin sudah tercipta di server (mis. hanya pemuatan ulang yang gagal).
            val sudahBerjalan = runCatching { api.perjalananAktif() }.getOrNull()
            if (sudahBerjalan != null) {
                _state.update { it.copy(layar = LayarPengantaran.DalamPerjalanan, perjalanan = sudahBerjalan, dipilih = emptySet(), pesan = null) }
                service.mulai(sudahBerjalan.pengaturan, sudahBerjalan.tibaCount(), sudahBerjalan.stops.size)
                return
            }
            // Daftar dimuat ulang: SJ yang sudah dibawa orang lain hilang dari urutan.
            val siap = runCatching { api.sjSiap() }.getOrDefault(_state.value.sjSiap)
            _state.update {
                it.copy(
                    pesan = pesanGalat(e),
                    sjSiap = siap,
                    urutan = it.urutan.filter { u -> siap.any { s -> s.suratJalanId == u.suratJalanId } },
                    dipilih = it.dipilih.filter { id -> siap.any { s -> s.suratJalanId == id } }.toSet(),
                )
            }
        } finally {
            _state.update { it.copy(sibuk = false) }
        }
    }

    /** Setelah galat aksi perjalanan: tampilkan keadaan server terbaru (bisa sudah tertutup). */
    private suspend fun segarkanSetelahGalat() {
        if (_state.value.pesan == null) return
        val aktif = runCatching { api.perjalananAktif() }.getOrElse { return }
        if (aktif != null) {
            _state.update { it.copy(perjalanan = aktif) }
            service.perbarui(aktif.tibaCount(), aktif.stops.size)
        } else {
            service.hentikan()
            _state.update { it.copy(layar = LayarPengantaran.Ringkasan, perjalanan = null, konfirmasiSelesai = false) }
        }
    }

    suspend fun tiba(stopId: String) {
        tibaInti(stopId)
        segarkanSetelahGalat()
    }

    private suspend fun tibaInti(stopId: String) = aman {
        val pos = lokasi.posisi() ?: throw IllegalStateException("Lokasi belum didapat. Pastikan GPS menyala.")
        val hasil = api.tandaiTiba(stopId, pos.lat, pos.lng, pos.akurasiM)
        if (hasil.statusPerjalanan != "berjalan") {
            service.hentikan()
            _state.update { it.copy(layar = LayarPengantaran.Ringkasan, perjalanan = null, ringkasan = null) }
        } else {
            val aktif = api.perjalananAktif()
            _state.update { it.copy(perjalanan = aktif) }
            aktif?.let { service.perbarui(it.tibaCount(), it.stops.size) }
        }
    }

    /** Ubah urutan stop yang masih menunggu (indeks di daftar menunggu). */
    suspend fun pindahBerjalan(dari: Int, ke: Int) {
        pindahBerjalanInti(dari, ke)
        segarkanSetelahGalat()
    }

    private suspend fun pindahBerjalanInti(dari: Int, ke: Int) = aman {
        val p = _state.value.perjalanan ?: return@aman
        val menunggu = p.stops.filter { it.status == "menunggu" }.toMutableList()
        if (dari !in menunggu.indices || ke !in menunggu.indices) return@aman
        menunggu.add(ke, menunggu.removeAt(dari))
        api.ubahUrutan(p.id, menunggu.map { it.id })
        _state.update { it.copy(perjalanan = api.perjalananAktif()) }
    }

    suspend fun mintaSelesaikan() {
        val p = _state.value.perjalanan ?: return
        if (p.adaMenunggu()) _state.update { it.copy(konfirmasiSelesai = true) } else selesaikan()
    }

    fun batalSelesaikan() = _state.update { it.copy(konfirmasiSelesai = false) }

    suspend fun selesaikan() {
        selesaikanInti()
        segarkanSetelahGalat()
    }

    private suspend fun selesaikanInti() = aman {
        val p = _state.value.perjalanan ?: return@aman
        val r = api.selesaikan(p.id)
        service.hentikan()
        _state.update { it.copy(layar = LayarPengantaran.Ringkasan, perjalanan = null, ringkasan = r, konfirmasiSelesai = false) }
    }
}

/**
 * Saat app dibuka (termasuk setelah proses dimatikan), driver yang masih punya
 * perjalanan berjalan langsung diarahkan ke layar Pengantaran agar service
 * lokasi menyala lagi. Galat jaringan = tidak memaksa (driver bisa buka manual).
 */
object PemulihanPengantaran {
    suspend fun perluDibuka(role: String?, perjalananAktif: suspend () -> PerjalananUi?): Boolean {
        if (role !in com.sukashawarma.superapp.data.Roles.PENGANTARAN) return false
        return runCatching { perjalananAktif() }.getOrNull() != null
    }
}
