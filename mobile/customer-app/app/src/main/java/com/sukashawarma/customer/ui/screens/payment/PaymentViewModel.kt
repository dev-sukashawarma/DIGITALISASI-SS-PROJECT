package com.sukashawarma.customer.ui.screens.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OrderAttemptStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.ui.components.pesanGalat
import com.sukashawarma.customer.ui.screens.checkout.kePayload
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Jeda antar-penanyaan status. */
private const val JEDA_TANYA_MS = 3_000L

/** Batas menunggu konfirmasi pembayaran. */
private const val BATAS_TUNGGU_MS = 5 * 60 * 1000L

data class PaymentState(
    val memuat: Boolean = false,
    val pesanGalat: String? = null,
    /** URL halaman pembayaran Xendit; dibuka dengan Custom Tabs. */
    val paymentUrl: String? = null,
    val orderId: String? = null,
    val menungguKonfirmasi: Boolean = false,
    val dibayar: Boolean = false,
    val gagalBayar: Boolean = false,
    val kadaluarsa: Boolean = false,
    val nomorPesanan: Int? = null,
    val waktuHabis: Boolean = false
)

class PaymentViewModel(
    private val repository: Repository,
    private val cart: CartStore,
    private val percobaan: OrderAttemptStore
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentState())
    val state: StateFlow<PaymentState> = _state.asStateFlow()

    /**
     * Membuat pesanan, atau melanjutkan percobaan yang belum selesai.
     *
     * `client_order_id` disimpan SEBELUM permintaan dikirim. Pembayaran
     * membawa pelanggan keluar aplikasi dan Android boleh mematikan prosesnya;
     * id yang hanya hidup di memori berarti tagihan kedua saat pelanggan
     * mencoba ulang.
     */
    fun bayar() {
        val baris = cart.isi()
        val outletId = cart.outletId()
        if (baris.isEmpty() || outletId == null) {
            _state.value = PaymentState(pesanGalat = "Keranjang sudah kosong.")
            return
        }

        val clientOrderId = percobaan.clientOrderId() ?: idPesananBaru().also {
            percobaan.simpanClientOrderId(it)
        }

        _state.value = _state.value.copy(memuat = true, pesanGalat = null)

        viewModelScope.launch {
            when (val hasil = repository.buatPesanan(clientOrderId, outletId, baris.map { it.kePayload() })) {
                is GatewayResult.Sukses -> {
                    val r = hasil.data
                    percobaan.simpanOrderId(r.orderId)
                    _state.value = _state.value.copy(
                        memuat = false,
                        orderId = r.orderId,
                        // `payment_url` bisa null kalau ini balasan duplikat
                        // untuk pesanan yang tagihannya sudah dibuat. Bukan
                        // galat: lanjut menanyakan status saja.
                        paymentUrl = r.paymentUrl
                    )
                    tanyaSampaiPasti(r.orderId)
                }

                is GatewayResult.Gagal -> {
                    // Satu-satunya kondisi yang boleh mengganti id. Lihat
                    // `idBerikutnya` -- salah arah di sini berarti pelanggan
                    // terkunci selamanya atau tertagih dua kali.
                    val idBerikut = idBerikutnya(clientOrderId, hasil.error)
                    if (idBerikut != clientOrderId) {
                        percobaan.simpanClientOrderId(idBerikut)
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
     * Menanyakan status sampai gateway memastikannya.
     *
     * Aplikasi TIDAK PERNAH menyimpulkan pembayaran berhasil dari fakta bahwa
     * pelanggan kembali dari halaman Xendit. Kebenarannya ada di webhook
     * Xendit ke gateway; layar ini hanya menunggu gateway mengakuinya.
     */
    fun tanyaSampaiPasti(orderId: String) {
        _state.value = _state.value.copy(menungguKonfirmasi = true, waktuHabis = false)

        viewModelScope.launch {
            val batas = System.currentTimeMillis() + BATAS_TUNGGU_MS

            while (System.currentTimeMillis() < batas) {
                when (val hasil = repository.statusPesanan(orderId)) {
                    is GatewayResult.Sukses -> {
                        val d = hasil.data
                        when (d.status) {
                            "dibayar" -> {
                                cart.kosongkan()
                                percobaan.selesai()
                                _state.value = _state.value.copy(
                                    menungguKonfirmasi = false,
                                    dibayar = true,
                                    nomorPesanan = d.posOrderNumber
                                )
                                return@launch
                            }
                            "gagal" -> {
                                _state.value = _state.value.copy(
                                    menungguKonfirmasi = false,
                                    gagalBayar = true
                                )
                                return@launch
                            }
                            "kadaluarsa" -> {
                                // Draft hangus. Percobaan berikutnya WAJIB
                                // memakai id baru, kalau tidak gateway
                                // membalas 409 selamanya.
                                percobaan.simpanClientOrderId(idPesananBaru())
                                _state.value = _state.value.copy(
                                    menungguKonfirmasi = false,
                                    kadaluarsa = true
                                )
                                return@launch
                            }
                        }
                    }
                    // Galat saat menanya BUKAN alasan berhenti: sinyal bisa
                    // putus sebentar sementara pembayaran sudah masuk.
                    is GatewayResult.Gagal -> Unit
                }

                delay(JEDA_TANYA_MS)
            }

            // Habis waktu bukan berarti gagal. Pesanan bisa saja tetap masuk;
            // pelanggan diarahkan memeriksa riwayat, bukan membayar lagi.
            _state.value = _state.value.copy(menungguKonfirmasi = false, waktuHabis = true)
        }
    }

    /** Melanjutkan percobaan yang tertinggal setelah aplikasi sempat mati. */
    fun lanjutkanJikaAda(): Boolean {
        val orderId = percobaan.orderId() ?: return false
        _state.value = _state.value.copy(orderId = orderId)
        tanyaSampaiPasti(orderId)
        return true
    }

    fun batalkanPercobaan() {
        percobaan.selesai()
        _state.value = PaymentState()
    }

    fun bersihkanGalat() {
        _state.value = _state.value.copy(pesanGalat = null)
    }
}

/**
 * Kalimat untuk galat saat membuat pesanan.
 *
 * `pesanan_sedang_diproses` sengaja TIDAK menyuruh pelanggan mencoba lagi
 * segera: percobaan sebelumnya masih berjalan, dan menekan tombol berkali-kali
 * di titik ini persis perilaku yang menghasilkan tagihan ganda.
 */
fun pesanBayar(galat: GatewayError): String = when {
    galat is GatewayError.Kode && galat.kode == "pesanan_sedang_diproses" ->
        "Pesananmu sedang diproses. Tunggu sebentar, jangan tekan bayar lagi."
    galat is GatewayError.Kode && galat.kode == "pesanan_kadaluarsa" ->
        "Batas waktu pembayaran sudah lewat. Tekan bayar lagi untuk memulai ulang."
    galat is GatewayError.Kode && galat.kode == "keranjang_berubah" ->
        "Menu outlet berubah sejak kamu memilih. Kembali ke ringkasan untuk memperbaikinya."
    else -> pesanGalat(galat)
}
