package com.sukashawarma.customer.ui.checkout

import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.CartItemPayload
import com.sukashawarma.customer.data.api.CartProblemDto
import com.sukashawarma.customer.data.api.CheckoutValidateResponse
import com.sukashawarma.customer.data.api.GatewayResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CheckoutViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `validasi dipanggil dua kali beruntun tidak menimbulkan galat palsu`() = runTest(dispatcher) {
        val cart = CartStore.diMemori().apply {
            pakaiOutlet("o1")
            tambah("m1", "Shawarma", 25000L, 1, null)
        }
        val req1 = CompletableDeferred<GatewayResult<CheckoutValidateResponse>>()
        val req2 = CompletableDeferred<GatewayResult<CheckoutValidateResponse>>()
        var n = 0
        val repo = object : Repository(null) {
            override suspend fun validasiCheckout(
                outletId: String,
                items: List<CartItemPayload>,
                voucher: PilihanVoucher?
            ): GatewayResult<CheckoutValidateResponse> {
                n++
                return if (n == 1) req1.await() else req2.await()
            }
        }

        val vm = CheckoutViewModel(repo, cart)
        dispatcher.scheduler.runCurrent()

        // Panggilan kedua membatalkan job pertama; saat req2 selesai, state harus sukses tanpa galat.
        vm.validasi()
        dispatcher.scheduler.runCurrent()
        assertTrue(vm.state.value.memuat)
        assertNull(vm.state.value.galat)

        req2.complete(GatewayResult.Sukses(CheckoutValidateResponse(ok = true, subtotal = 25000.0, total = 25000.0)))
        advanceUntilIdle()

        assertNull(vm.state.value.galat)
        assertEquals(25000L, vm.state.value.total)
        assertTrue(vm.state.value.bolehLanjut)
    }

    @Test
    fun `perbaiki menghapus item habis langsung memperbarui snapshot CartStore reaktif`() = runTest(dispatcher) {
        val cart = CartStore.diMemori().apply {
            pakaiOutlet("o1")
            tambah("m1", "Habis", 20000L, 1, null)
            tambah("m2", "Tersedia", 25000L, 1, null)
        }
        val repo = object : Repository(null) {
            override suspend fun validasiCheckout(
                outletId: String,
                items: List<CartItemPayload>,
                voucher: PilihanVoucher?
            ) = GatewayResult.Sukses(CheckoutValidateResponse(ok = true, subtotal = 25000.0, total = 25000.0))
        }

        val vm = CheckoutViewModel(repo, cart)
        advanceUntilIdle()
        vm.perbaiki(CartProblemDto(menuItemId = "m1", name = "Habis", jenis = "habis"))
        advanceUntilIdle()

        assertEquals(listOf("m2"), cart.snapshot.value.baris.map { it.menuItemId })
        assertEquals(25000L, cart.snapshot.value.subtotal)
    }
}
