package com.sukashawarma.customer.ui.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OrderAttemptStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.OrderDetailDto
import com.sukashawarma.customer.data.uraiWaktuIso
import com.sukashawarma.customer.ui.checkout.kePayloadList
import com.sukashawarma.customer.ui.components.pesanGalat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

private const val JEDA_TANYA_AWAL_MS = 3_000L
private const val JEDA_TANYA_LANJUT_MS = 10_000L
private const val AMBANG_JEDA_MS = 60 * 1000L
private const val BATAS_TUNGGU_MS = 15 * 60 * 1000L
private const val TENGGANG_EXPIRES_MS = 15_000L

data class PaymentState(
    val memuat: Boolean = false,
    val sedangMembatalkan: Boolean = false,
    val pesanGalat: String? = null,
    val qrString: String? = null,
    val paymentUrl: String? = null,
    val orderId: String? = null,
    val menungguKonfirmasi: Boolean = false,
    val dibayar: Boolean = false,
    val gagalBayar: Boolean = false,
    val kadaluarsa: Boolean = false,
    val nomorPesanan: Int? = null,
    val waktuHabis: Boolean = false,
    val urlBayarTersimpan: String? = null,
    val totalTagihan: Long = 0L,
    val expiresAt: String? = null
)

class PaymentViewModel(
    private val repository: Repository,
    private val cart: CartStore,
    private val percobaan: OrderAttemptStore,
    private val appScope: CoroutineScope? = null
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentState(totalTagihan = totalAwal()))
    val state: StateFlow<PaymentState> = _state.asStateFlow()
    private var pollingJob: Job? = null
    private var bayarJob: Job? = null
    private var cekJob: Job? = null
    private var sudahMulai: Boolean = false

    private fun totalAwal(): Long = if (cart.voucher() != null) 0L else cart.subtotal()

    fun bayar() {
        if (bayarJob?.isActive == true || _state.value.sedangMembatalkan) return

        val baris = cart.isi()
        val outletId = cart.outletId()
        val total = cart.subtotal()
        if (baris.isEmpty() || outletId == null) {
            _state.value = PaymentState(pesanGalat = "Keranjang sudah kosong.", totalTagihan = total)
            return
        }

        val sidikSekarang = cart.sidikJari()
        val clientOrderId = percobaan.clientOrderId() ?: idPesananBaru().also {
            percobaan.simpanClientOrderId(it)
        }
        percobaan.simpanSidikJari(sidikSekarang)

        _state.value = _state.value.copy(
            memuat = true,
            pesanGalat = null,
            gagalBayar = false,
            kadaluarsa = false,
            waktuHabis = false,
            totalTagihan = totalAwal()
        )

        bayarJob = viewModelScope.launch {
            when (
                val hasil = repository.buatPesanan(
                    clientOrderId,
                    outletId,
                    baris.flatMap { it.kePayloadList() },
                    voucher = cart.voucher()
                )
            ) {
                is GatewayResult.Sukses -> {
                    val r = hasil.data
                    percobaan.simpanOrderId(r.orderId)
                    r.paymentUrl?.let { percobaan.simpanPaymentUrl(it) }
                    _state.value = _state.value.copy(
                        memuat = false,
                        orderId = r.orderId,
                        qrString = r.qrString,
                        paymentUrl = r.paymentUrl,
                        totalTagihan = r.totalAmount.roundToLong(),
                        expiresAt = r.expiresAt
                    )
                    tanyaSampaiPasti(r.orderId)
                }

                is GatewayResult.Gagal -> {
                    val idBerikut = idBerikutnya(clientOrderId, hasil.error)
                    if (idBerikut != clientOrderId) {
                        percobaan.selesai()
                        percobaan.simpanClientOrderId(idBerikut)
                        percobaan.simpanSidikJari(sidikSekarang)
                    }
                    _state.value = _state.value.copy(
                        memuat = false,
                        pesanGalat = pesanBayar(hasil.error)
                    )
                }
            }
        }
    }

    /**
     * Menerapkan detail pesanan hasil polling / cek manual.
     * Mengembalikan `true` bila status sudah terminal (polling harus berhenti).
     */
    private fun terapkanDetailStatus(d: OrderDetailDto): Boolean {
        _state.value = _state.value.copy(
            totalTagihan = d.totalAmount.roundToLong(),
            expiresAt = d.expiresAt ?: _state.value.expiresAt,
            // Isi QR & URL cadangan bila sebelumnya kosong (mis. gagal jaringan di mulai()).
            qrString = d.qrString ?: _state.value.qrString,
            urlBayarTersimpan = d.paymentUrl ?: _state.value.urlBayarTersimpan
        )
        return when (nasibPercobaan(d.status, d.expiresAt, System.currentTimeMillis())) {
            NasibPercobaan.DIBAYAR -> {
                cart.kosongkan()
                percobaan.selesai()
                _state.value = _state.value.copy(
                    menungguKonfirmasi = false,
                    dibayar = true,
                    nomorPesanan = d.posOrderNumber
                )
                true
            }
            NasibPercobaan.GAGAL -> {
                percobaan.selesai()
                _state.value = _state.value.copy(
                    menungguKonfirmasi = false,
                    gagalBayar = true,
                    qrString = null,
                    paymentUrl = null,
                    urlBayarTersimpan = null
                )
                true
            }
            NasibPercobaan.MULAI_BARU -> {
                percobaan.selesai()
                _state.value = _state.value.copy(
                    menungguKonfirmasi = false,
                    kadaluarsa = true,
                    qrString = null,
                    paymentUrl = null,
                    urlBayarTersimpan = null
                )
                true
            }
            NasibPercobaan.LANJUTKAN -> false
        }
    }

    fun tanyaSampaiPasti(orderId: String) {
        pollingJob?.cancel()
        _state.value = _state.value.copy(menungguKonfirmasi = true, waktuHabis = false)

        pollingJob = viewModelScope.launch {
            val mulai = System.currentTimeMillis()
            val batasDefault = mulai + BATAS_TUNGGU_MS

            while (true) {
                val batasDariExpires = _state.value.expiresAt
                    ?.let { uraiWaktuIso(it) }
                    ?.let { it + TENGGANG_EXPIRES_MS }
                val batas = minOf(batasDefault, batasDariExpires ?: batasDefault)
                if (System.currentTimeMillis() >= batas) break

                when (val hasil = repository.statusPesanan(orderId)) {
                    is GatewayResult.Sukses -> {
                        if (terapkanDetailStatus(hasil.data)) return@launch
                    }
                    is GatewayResult.Gagal -> {
                        if (hasil.error is GatewayError.SesiTidakSah) {
                            _state.value = _state.value.copy(
                                menungguKonfirmasi = false,
                                pesanGalat = pesanBayar(hasil.error)
                            )
                            return@launch
                        }
                    }
                }

                val terlewat = System.currentTimeMillis() - mulai
                delay(if (terlewat < AMBANG_JEDA_MS) JEDA_TANYA_AWAL_MS else JEDA_TANYA_LANJUT_MS)
            }

            // Cek apakah kedaluwarsa berdasarkan expiresAt sebelum jatuh ke waktuHabis.
            val batasIso = _state.value.expiresAt?.let { uraiWaktuIso(it) }
            if (batasIso != null && System.currentTimeMillis() >= batasIso) {
                percobaan.selesai()
                _state.value = _state.value.copy(
                    menungguKonfirmasi = false,
                    kadaluarsa = true,
                    qrString = null,
                    paymentUrl = null,
                    urlBayarTersimpan = null
                )
            } else {
                _state.value = _state.value.copy(
                    menungguKonfirmasi = false,
                    waktuHabis = true,
                    qrString = null,
                    paymentUrl = null,
                    urlBayarTersimpan = null
                )
            }
        }
    }

    /** Dipanggil saat countdown QRIS menyentuh 00:00 untuk segera menyinkronkan status. */
    fun waktuTimerHabis() {
        val s = _state.value
        if (s.dibayar || s.gagalBayar || s.kadaluarsa || s.waktuHabis || s.memuat) return
        periksaStatusSekarang()
    }

    fun periksaStatusSekarang() {
        if (_state.value.memuat || _state.value.sedangMembatalkan || cekJob?.isActive == true) return
        val orderId = _state.value.orderId ?: percobaan.orderId()
        if (orderId == null) {
            bayar()
            return
        }
        cekJob = viewModelScope.launch {
            when (val hasil = repository.statusPesanan(orderId)) {
                is GatewayResult.Sukses -> {
                    if (terapkanDetailStatus(hasil.data)) {
                        pollingJob?.cancel()
                    }
                }
                is GatewayResult.Gagal -> {
                    if (hasil.error is GatewayError.SesiTidakSah) {
                        pollingJob?.cancel()
                        _state.value = _state.value.copy(
                            menungguKonfirmasi = false,
                            pesanGalat = pesanBayar(hasil.error)
                        )
                    }
                }
            }
        }
    }

    /**
     * Titik masuk layar pembayaran. Hanya berjalan sekali per instans ViewModel
     * agar perubahan konfigurasi tidak memicu `bayar()` ganda.
     */
    fun mulai() {
        if (sudahMulai) return
        sudahMulai = true

        val orderId = percobaan.orderId()
        if (orderId == null) {
            bayar()
            return
        }

        // Bila keranjang/voucher/outlet berubah sejak percobaan sebelumnya dibuat,
        // batalkan draft lama (di scope proses) lalu buat pesanan baru untuk keranjang terbaru.
        val sidikTersimpan = percobaan.sidikJari()
        val sidikSekarang = cart.sidikJari()
        if (sidikTersimpan != null && sidikTersimpan != sidikSekarang) {
            (appScope ?: viewModelScope).launch {
                repository.batalkanPesanan(orderId)
            }
            percobaan.selesai()
            bayar()
            return
        }

        _state.value = _state.value.copy(memuat = true, orderId = orderId, totalTagihan = 0L)

        bayarJob = viewModelScope.launch {
            when (val hasil = repository.statusPesanan(orderId)) {
                is GatewayResult.Gagal -> {
                    if (hasil.error is GatewayError.SesiTidakSah) {
                        _state.value = _state.value.copy(
                            memuat = false,
                            pesanGalat = pesanBayar(hasil.error)
                        )
                        return@launch
                    }
                    _state.value = _state.value.copy(memuat = false, totalTagihan = 0L)
                    tanyaSampaiPasti(orderId)
                }

                is GatewayResult.Sukses -> {
                    val d = hasil.data
                    when (nasibPercobaan(d.status, d.expiresAt, System.currentTimeMillis())) {
                        NasibPercobaan.DIBAYAR -> {
                            cart.kosongkan()
                            percobaan.selesai()
                            _state.value = _state.value.copy(
                                memuat = false,
                                dibayar = true,
                                nomorPesanan = d.posOrderNumber
                            )
                        }

                        NasibPercobaan.GAGAL -> {
                            percobaan.selesai()
                            _state.value = _state.value.copy(memuat = false, gagalBayar = true)
                        }

                        NasibPercobaan.MULAI_BARU -> {
                            percobaan.selesai()
                            _state.value = _state.value.copy(memuat = false, orderId = null)
                            bayarJob = null
                            bayar()
                        }

                        NasibPercobaan.LANJUTKAN -> {
                            _state.value = _state.value.copy(
                                memuat = false,
                                qrString = d.qrString,
                                urlBayarTersimpan = d.paymentUrl ?: percobaan.paymentUrl(),
                                totalTagihan = d.totalAmount.roundToLong(),
                                expiresAt = d.expiresAt
                            )
                            tanyaSampaiPasti(orderId)
                        }
                    }
                }
            }
        }
    }

    /**
     * Membatalkan draft di server SEBELUM menghapus [OrderAttemptStore] dan keluar layar.
     * Menjalankan request pada [appScope] agar tidak ikut ter-cancel bila layar di-pop,
     * serta menolak hapus jika ternyata server melaporkan pesanan sudah `dibayar`.
     */
    fun batalkanPercobaan(onSelesaiBatal: () -> Unit = {}) {
        if (_state.value.sedangMembatalkan) return
        pollingJob?.cancel()
        pollingJob = null
        bayarJob?.cancel()
        bayarJob = null

        val orderId = _state.value.orderId ?: percobaan.orderId()
        if (orderId == null) {
            percobaan.selesai()
            _state.value = PaymentState()
            onSelesaiBatal()
            return
        }

        _state.value = _state.value.copy(sedangMembatalkan = true, pesanGalat = null)
        val scope = appScope ?: viewModelScope
        val tugasBatal = scope.async { repository.batalkanPesanan(orderId) }
        viewModelScope.launch {
            when (val hasil = tugasBatal.await()) {
                is GatewayResult.Sukses -> {
                    percobaan.selesai()
                    _state.value = PaymentState()
                    onSelesaiBatal()
                }
                is GatewayResult.Gagal -> {
                    if (hasil.error is GatewayError.Kode && hasil.error.kode == "pesanan_sudah_dibayar") {
                        _state.value = _state.value.copy(sedangMembatalkan = false)
                        periksaStatusSekarang()
                    } else {
                        _state.value = _state.value.copy(
                            sedangMembatalkan = false,
                            pesanGalat = pesanBayar(hasil.error)
                        )
                    }
                }
            }
        }
    }

    fun bersihkanGalat() {
        _state.value = _state.value.copy(pesanGalat = null)
    }
}

internal fun pesanBayar(error: GatewayError): String = when (error) {
    is GatewayError.Kode -> when (error.kode) {
        "pesanan_sedang_diproses" ->
            "Pesananmu sedang dibuat. Tunggu beberapa detik lalu coba lagi."
        "pesanan_kadaluarsa" ->
            "Batas waktu pesanan sebelumnya sudah habis. Tekan Coba lagi untuk membuat pesanan baru."
        "pesanan_sudah_dibayar" ->
            "Pesanan ini sudah dibayar. Memeriksa status pesananmu..."
        else -> error.pesan
    }
    else -> pesanGalat(error)
}
