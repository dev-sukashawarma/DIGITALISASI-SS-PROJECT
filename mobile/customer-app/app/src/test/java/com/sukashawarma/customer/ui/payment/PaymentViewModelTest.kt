package com.sukashawarma.customer.ui.payment

import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OrderAttemptStore
import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.CartItemPayload
import com.sukashawarma.customer.data.api.CreateOrderResponse
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.OrderDetailDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PaymentViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun detail(
        id: String = "ord-1",
        status: String = "menunggu_bayar",
        qr: String? = "000201QR",
        total: Double = 25000.0,
        expiresAt: String? = "2099-01-01T00:00:00.000Z",
        posNumber: Int? = null
    ) = OrderDetailDto(
        id = id,
        status = status,
        statusDapur = null,
        totalAmount = total,
        posOrderNumber = posNumber,
        outletName = "Empang",
        createdAt = "2026-10-01T00:00:00.000Z",
        expiresAt = expiresAt,
        paymentUrl = null,
        qrString = qr
    )

    @Test
    fun `keranjang berubah sejak QRIS lama dibuat membatalkan draft lama dan membuat pesanan baru`() = runTest(dispatcher) {
        val cart = CartStore.diMemori().apply {
            pakaiOutlet("o1")
            tambah("m1", "Shawarma", 25000L, 1, null)
        }
        val attempt = OrderAttemptStore.diMemori().apply {
            simpanClientOrderId("cli-lama")
            simpanOrderId("ord-lama")
            simpanSidikJari(cart.sidikJari())
        }

        // Pelanggan mengubah keranjang (pasang voucher) sebelum kembali ke layar Bayar.
        cart.pasangVoucher(PilihanVoucher(id = "v1", nama = "Diskon 5rb"))

        val dibatalkan = mutableListOf<String>()
        var buatPesananDipanggil = 0
        val repo = object : Repository(null) {
            override suspend fun batalkanPesanan(orderId: String): GatewayResult<Unit> {
                dibatalkan.add(orderId)
                return GatewayResult.Sukses(Unit)
            }
            override suspend fun buatPesanan(
                clientOrderId: String,
                outletId: String,
                items: List<CartItemPayload>,
                telepon: String?,
                voucher: PilihanVoucher?
            ): GatewayResult<CreateOrderResponse> {
                buatPesananDipanggil++
                return GatewayResult.Sukses(
                    CreateOrderResponse(
                        orderId = "ord-baru",
                        paymentUrl = null,
                        qrString = "000201BARU",
                        totalAmount = 20000.0,
                        expiresAt = "2099-01-01T00:00:00.000Z"
                    )
                )
            }
            override suspend fun statusPesanan(orderId: String): GatewayResult<OrderDetailDto> =
                GatewayResult.Sukses(detail(id = orderId, status = "dibayar", posNumber = 42, total = 20000.0))
        }

        val vm = PaymentViewModel(repo, cart, attempt, appScope = backgroundScope)
        vm.mulai()
        advanceUntilIdle()

        assertEquals(listOf("ord-lama"), dibatalkan)
        assertEquals(1, buatPesananDipanggil)
        assertTrue(vm.state.value.dibayar)
        assertEquals("ord-baru", vm.state.value.orderId)
    }

    @Test
    fun `batalkanPercobaan menunggu server dan menolak hapus bila ternyata sudah dibayar`() = runTest(dispatcher) {
        val cart = CartStore.diMemori().apply {
            pakaiOutlet("o1")
            tambah("m1", "Shawarma", 25000L, 1, null)
        }
        val attempt = OrderAttemptStore.diMemori().apply {
            simpanClientOrderId("cli-1")
            simpanOrderId("ord-1")
            simpanSidikJari(cart.sidikJari())
        }
        val repo = object : Repository(null) {
            override suspend fun batalkanPesanan(orderId: String): GatewayResult<Unit> =
                GatewayResult.Gagal(GatewayError.Kode("pesanan_sudah_dibayar", "Sudah dibayar"))
            override suspend fun statusPesanan(orderId: String): GatewayResult<OrderDetailDto> =
                GatewayResult.Sukses(detail(id = orderId, status = "dibayar", posNumber = 99))
        }

        val vm = PaymentViewModel(repo, cart, attempt, appScope = backgroundScope)
        var popDipanggil = false
        vm.batalkanPercobaan { popDipanggil = true }
        advanceUntilIdle()

        assertFalse(popDipanggil)
        assertTrue(vm.state.value.dibayar)
        assertEquals(99, vm.state.value.nomorPesanan)
    }

    @Test
    fun `gagal jaringan di mulai lalu polling sukses mengisi qrString bukan macet spinner`() = runTest(dispatcher) {
        val cart = CartStore.diMemori().apply {
            pakaiOutlet("o1")
            tambah("m1", "Shawarma", 25000L, 1, null)
        }
        val attempt = OrderAttemptStore.diMemori().apply {
            simpanClientOrderId("cli-1")
            simpanOrderId("ord-1")
            simpanSidikJari(cart.sidikJari())
        }
        var panggilan = 0
        val repo = object : Repository(null) {
            override suspend fun statusPesanan(orderId: String): GatewayResult<OrderDetailDto> {
                panggilan++
                return when (panggilan) {
                    1 -> GatewayResult.Gagal(GatewayError.Jaringan(RuntimeException("timeout")))
                    2 -> GatewayResult.Sukses(detail(id = orderId, status = "menunggu_bayar", qr = "000201PULIH"))
                    else -> GatewayResult.Sukses(detail(id = orderId, status = "gagal"))
                }
            }
        }

        val vm = PaymentViewModel(repo, cart, attempt, appScope = backgroundScope)
        vm.mulai()
        // Jalankan hanya sampai poll pertama sukses sebelum poll ke-3 menggagalkan.
        dispatcher.scheduler.runCurrent()
        assertEquals("000201PULIH", vm.state.value.qrString)
        // Lanjutkan sampai poll ke-3 ('gagal') -> OrderAttemptStore wajib dibersihkan total.
        advanceUntilIdle()
        assertTrue(vm.state.value.gagalBayar)
        assertNull(attempt.orderId())
        assertNull(attempt.clientOrderId())
    }
}
