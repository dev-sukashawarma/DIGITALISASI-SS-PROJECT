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

/** Jeda antar-penanyaan status selama menit pertama. */
private const val JEDA_TANYA_AWAL_MS = 3_000L

/**
 * Jeda setelah menit pertama lewat.
 *
 * Pembayaran yang mulus sudah dikonfirmasi dalam hitungan detik. Yang tersisa
 * setelah semenit adalah pelanggan yang sedang bergulat dengan aplikasi
 * banknya -- salah PIN, saldo kurang, top-up dulu. Menanyai server tiap tiga
 * detik selama belasan menit untuk itu memboroskan baterai dan kuota tanpa
 * mempercepat apa pun.
 */
private const val JEDA_TANYA_LANJUT_MS = 10_000L

/** Ambang perpindahan antara kedua jeda di atas. */
private const val AMBANG_JEDA_MS = 60 * 1000L

/**
 * Batas menunggu konfirmasi pembayaran.
 *
 * DISAMAKAN DENGAN UMUR DRAFT DAN UMUR QR (`BATAS_BAYAR_DETIK` di gateway,
 * 15 menit). Sebelumnya 5 menit, dan selisih sepuluh menit itu punya wujud
 * nyata: QR di tangan pelanggan masih sah, tetapi layar sudah menyerah dan
 * berkata "belum ada kabar". Pesanannya tetap masuk -- webhook tidak peduli
 * aplikasi masih menonton atau tidak -- tapi orang yang sedang menatap layar
 * itu tidak punya cara tahu.
 *
 * Kalau umur draft di gateway diubah, angka ini WAJIB ikut. Menunggu lebih
 * lama dari umur draft hanya memperpanjang tatapan pada pesanan yang sudah
 * mati; menunggu lebih singkat mengembalikan lubang yang baru saja ditutup.
 */
private const val BATAS_TUNGGU_MS = 15 * 60 * 1000L

data class PaymentState(
    val memuat: Boolean = false,
    val pesanGalat: String? = null,
    /**
     * Teks QRIS yang digambar aplikasi sendiri. Ini jalur utama.
     */
    val qrString: String? = null,
    /**
     * URL halaman pembayaran Xendit; dibuka dengan Custom Tabs.
     *
     * CADANGAN, dipakai hanya ketika `qrString` kosong -- yaitu ketika QR Code
     * API menolak dan gateway jatuh ke Invoice. Selama masih ada QR, pelanggan
     * tidak pernah dilempar ke peramban.
     */
    val paymentUrl: String? = null,
    val orderId: String? = null,
    val menungguKonfirmasi: Boolean = false,
    val dibayar: Boolean = false,
    val gagalBayar: Boolean = false,
    val kadaluarsa: Boolean = false,
    val nomorPesanan: Int? = null,
    val waktuHabis: Boolean = false,
    /**
     * URL pembayaran percobaan yang DILANJUTKAN.
     *
     * Dipisah dari [paymentUrl] dengan sengaja: `paymentUrl` memicu pembukaan
     * otomatis, sedangkan yang ini hanya menyalakan tombol. Membuka otomatis
     * saat melanjutkan akan melempar pelanggan kembali ke Chrome tepat setelah
     * ia menutupnya -- lingkaran yang tak bisa diputus.
     */
    val urlBayarTersimpan: String? = null
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
                    r.paymentUrl?.let { percobaan.simpanPaymentUrl(it) }
                    _state.value = _state.value.copy(
                        memuat = false,
                        orderId = r.orderId,
                        qrString = r.qrString,
                        // Keduanya bisa null kalau ini balasan duplikat untuk
                        // pesanan yang tagihannya sudah dibuat. Bukan galat:
                        // lanjut menanyakan status saja.
                        //
                        // Custom Tab HANYA dibuka bila tidak ada QR -- lihat
                        // penjaga di PaymentWaitScreen.
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
            val mulai = System.currentTimeMillis()
            val batas = mulai + BATAS_TUNGGU_MS

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

                val terlewat = System.currentTimeMillis() - mulai
                delay(if (terlewat < AMBANG_JEDA_MS) JEDA_TANYA_AWAL_MS else JEDA_TANYA_LANJUT_MS)
            }

            // Habis waktu bukan berarti gagal. Pesanan bisa saja tetap masuk;
            // pelanggan diarahkan memeriksa riwayat, bukan membayar lagi.
            _state.value = _state.value.copy(menungguKonfirmasi = false, waktuHabis = true)
        }
    }

    /**
     * Titik masuk layar pembayaran.
     *
     * Kalau ada percobaan tertinggal, statusnya DIPERIKSA dulu -- tidak
     * langsung dipantau. Versi sebelumnya memantau apa pun yang tersimpan,
     * termasuk draft yang batas waktunya sudah lewat: pelanggan menonton
     * pemuat lima menit penuh untuk pesanan yang tidak akan pernah berubah,
     * lalu diberi pesan "belum ada kabar" yang keliru.
     *
     * Galat jaringan saat memeriksa TIDAK memulai pesanan baru. Pesanan lama
     * mungkin masih hidup, dan membuat yang baru berarti tagihan kedua.
     */
    fun mulai() {
        val orderId = percobaan.orderId()
        if (orderId == null) {
            bayar()
            return
        }

        _state.value = _state.value.copy(memuat = true, orderId = orderId)

        viewModelScope.launch {
            when (val hasil = repository.statusPesanan(orderId)) {
                is GatewayResult.Gagal -> {
                    // Tidak tahu nasibnya. Arah aman: pantau, jangan menagih ulang.
                    _state.value = _state.value.copy(memuat = false)
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
                            // Percobaan lama mati. Dibuang, lalu pesanan baru
                            // dibuat dengan client_order_id baru -- id lama
                            // sudah terpakai dan akan ditolak 409 selamanya.
                            percobaan.selesai()
                            _state.value = _state.value.copy(memuat = false, orderId = null)
                            bayar()
                        }

                        NasibPercobaan.LANJUTKAN -> {
                            // Tagihannya masih berlaku. Pelanggan HARUS punya
                            // jalan membukanya lagi -- kalau tidak, ia terjebak
                            // menatap pemuat sementara pesanan kedua ditolak
                            // demi mencegah tagihan ganda.
                            _state.value = _state.value.copy(
                                memuat = false,
                                // QR yang sama ditampilkan lagi, bukan tagihan
                                // kedua. Server didahulukan untuk URL cadangan:
                                // salinan lokal hilang saat aplikasi dipasang
                                // ulang atau pelanggan ganti perangkat.
                                qrString = d.qrString,
                                urlBayarTersimpan = d.paymentUrl ?: percobaan.paymentUrl()
                            )
                            tanyaSampaiPasti(orderId)
                        }
                    }
                }
            }
        }
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
