package com.sukashawarma.customer.data

import com.sukashawarma.customer.data.api.CartItemPayload
import com.sukashawarma.customer.data.api.CheckoutValidateRequest
import com.sukashawarma.customer.data.api.CheckoutValidateResponse
import com.sukashawarma.customer.data.api.GatewayClient
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.data.api.OutletDto

/**
 * Satu-satunya pintu data aplikasi. Semua layar lewat sini, dan sini hanya
 * bicara ke [GatewayClient] — tidak ada jalur lain ke database.
 *
 * Membungkus [GatewayResult] apa adanya, tidak menelan galat jadi daftar
 * kosong: layar wajib bisa membedakan "menu memang belum ada" dari "gagal
 * memuat menu", karena tindakan pelanggan untuk keduanya berbeda.
 */
class Repository(private val gateway: GatewayClient) {

    suspend fun outlets(): GatewayResult<List<OutletDto>> =
        when (val hasil = gateway.outlets()) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(hasil.data.outlets)
            is GatewayResult.Gagal -> hasil
        }

    suspend fun katalog(outletId: String): GatewayResult<List<MenuItemDto>> =
        when (val hasil = gateway.catalog(outletId)) {
            is GatewayResult.Sukses -> GatewayResult.Sukses(hasil.data.items)
            is GatewayResult.Gagal -> hasil
        }

    /**
     * Validasi pra-bayar.
     *
     * PENTING: penolakan bisnis datang sebagai HTTP **200** dengan
     * `ok: false` -- bukan sebagai galat. Jadi `GatewayResult.Sukses` di sini
     * TIDAK berarti pesanan boleh lanjut; pemanggil wajib memeriksa
     * `response.ok`. Memperlakukan 200 sebagai lampu hijau adalah cara paling
     * mudah mengirim pelanggan ke pembayaran untuk pesanan yang sudah ditolak.
     */
    suspend fun validasiCheckout(
        outletId: String,
        items: List<CartItemPayload>
    ): GatewayResult<CheckoutValidateResponse> =
        gateway.checkoutValidate(CheckoutValidateRequest(outletId = outletId, items = items))
}
