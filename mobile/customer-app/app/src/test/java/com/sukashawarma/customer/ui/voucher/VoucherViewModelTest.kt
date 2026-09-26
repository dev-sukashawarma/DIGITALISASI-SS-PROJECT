package com.sukashawarma.customer.ui.voucher

import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.VoucherDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * `VoucherViewModel` memakai `viewModelScope`, yang butuh `Dispatchers.Main`
 * terpasang -- tidak ada `MainDispatcherRule` bersama di repo ini (belum ada
 * `ViewModelTest` lain), jadi dipasang/dicopot langsung di sini.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class VoucherViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `memuat daftar lalu pakai memasang voucher di keranjang`() = runTest {
        val cart = CartStore.diMemori()
        val v = VoucherDto(id = "v1", nama = "Hemat", jenis = "persen", kalimatSyarat = "Potongan 10%", status = "berlaku")
        val vm = VoucherViewModel(muat = { GatewayResult.Sukses(listOf(v)) }, cart = cart)
        advanceUntilIdle()
        assertEquals(listOf(v), vm.state.value.vouchers)
        vm.pakai(v)
        assertEquals(PilihanVoucher(id = "v1", nama = "Hemat"), cart.voucher())
    }

    @Test
    fun `galat ditampilkan`() = runTest {
        val vm = VoucherViewModel(muat = { GatewayResult.Gagal(GatewayError.Server(502)) }, cart = CartStore.diMemori())
        advanceUntilIdle()
        assertEquals(GatewayError.Server(502), vm.state.value.galat)
    }
}
