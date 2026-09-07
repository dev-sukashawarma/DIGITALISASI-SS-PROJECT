package com.sukashawarma.customer.ui.screens.checkout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.CartLine
import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.CartItemPayload
import com.sukashawarma.customer.data.api.CartProblemDto
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

data class CheckoutState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val baris: List<CartLine> = emptyList(),
    /** Semua nilai uang di bawah berasal dari gateway, bukan hitungan sendiri. */
    val subtotal: Long? = null,
    val potongan: Long? = null,
    val total: Long? = null,
    val masalah: List<CartProblemDto> = emptyList(),
    val alasan: String? = null,
    val pesanPenolakan: String? = null,
    val keranjangKosong: Boolean = false
) {
    /** Boleh lanjut membayar hanya kalau gateway benar-benar meloloskannya. */
    val bolehLanjut: Boolean
        get() = !memuat && galat == null && total != null && masalah.isEmpty() && alasan == null
}

fun CartLine.kePayload() = CartItemPayload(
    menuItemId = menuItemId,
    name = nama,
    unitPrice = hargaSatuan.toDouble(),
    quantity = jumlah,
    note = catatan
)

class CheckoutViewModel(
    private val repository: Repository,
    private val cart: CartStore
) : ViewModel() {

    private val _state = MutableStateFlow(CheckoutState())
    val state: StateFlow<CheckoutState> = _state.asStateFlow()

    init {
        validasi()
    }

    fun validasi() {
        val baris = cart.isi()
        val outletId = cart.outletId()

        if (baris.isEmpty() || outletId == null) {
            _state.value = CheckoutState(memuat = false, keranjangKosong = true)
            return
        }

        _state.value = _state.value.copy(
            memuat = true,
            galat = null,
            baris = baris,
            masalah = emptyList(),
            alasan = null,
            pesanPenolakan = null
        )

        viewModelScope.launch {
            when (val hasil = repository.validasiCheckout(outletId, baris.map { it.kePayload() })) {
                is GatewayResult.Gagal -> {
                    _state.value = _state.value.copy(memuat = false, galat = hasil.error)
                }
                is GatewayResult.Sukses -> {
                    val r = hasil.data
                    if (r.ok) {
                        // Angka yang ditampilkan adalah angka gateway. Menghitung
                        // ulang di aplikasi berisiko menampilkan total yang
                        // berbeda dari yang benar-benar ditagih.
                        _state.value = _state.value.copy(
                            memuat = false,
                            subtotal = r.subtotal?.roundToLong(),
                            potongan = r.discountAmount?.roundToLong(),
                            total = r.total?.roundToLong(),
                            masalah = emptyList(),
                            alasan = null,
                            pesanPenolakan = null
                        )
                    } else {
                        // HTTP 200 dengan `ok: false` adalah PENOLAKAN, bukan
                        // keberhasilan. Total sengaja dikosongkan supaya tidak
                        // ada jalan menuju pembayaran dari keadaan ini.
                        _state.value = _state.value.copy(
                            memuat = false,
                            subtotal = null,
                            potongan = null,
                            total = null,
                            masalah = r.masalah ?: emptyList(),
                            alasan = r.alasan,
                            pesanPenolakan = pesanUntukAlasan(r.alasan, r.pesan)
                        )
                    }
                }
            }
        }
    }

    /**
     * Menjalankan pemulihan untuk satu masalah, lalu memvalidasi ulang.
     *
     * Keranjang TIDAK pernah dibuang seluruhnya: hanya item bermasalah yang
     * disentuh. Pelanggan memilih item lainnya dengan sengaja, dan membuang
     * semuanya karena satu item habis berarti menghukumnya atas keadaan
     * outlet.
     */
    fun perbaiki(masalah: CartProblemDto) {
        if (masalah.jenis == "harga_berubah" && masalah.hargaBaru != null) {
            cart.perbaruiHarga(masalah.menuItemId, masalah.hargaBaru.roundToLong())
        } else {
            cart.hapusMenuItem(masalah.menuItemId)
        }
        validasi()
    }

    /** Memperbaiki seluruh masalah sekaligus, dengan aturan yang sama. */
    fun perbaikiSemua() {
        _state.value.masalah.forEach { masalah ->
            if (masalah.jenis == "harga_berubah" && masalah.hargaBaru != null) {
                cart.perbaruiHarga(masalah.menuItemId, masalah.hargaBaru.roundToLong())
            } else {
                cart.hapusMenuItem(masalah.menuItemId)
            }
        }
        validasi()
    }
}
