package com.sukashawarma.customer.ui.menu

import com.sukashawarma.customer.data.CartStore
import com.sukashawarma.customer.data.OutletStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.BannersResponse
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.data.api.OutletDto
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CatalogViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun outlet(id: String, nama: String, bisaPesan: Boolean = true) =
        OutletDto(id = id, name = nama, isActive = true, bisaPesan = bisaPesan)

    private fun item(id: String, nama: String) =
        MenuItemDto(id = id, name = nama, price = 25000.0, isAvailable = true)

    @Test
    fun `pengguna baru dengan banyak outlet langsung buka Beranda memakai outlet buka pertama`() = runTest(dispatcher) {
        val outletA = outlet("a", "Cabang Tutup", bisaPesan = false)
        val outletB = outlet("b", "Cabang Buka", bisaPesan = true)
        val outletStore = OutletStore.diMemori()
        val repo = object : Repository(null) {
            override suspend fun outlets() = GatewayResult.Sukses(listOf(outletA, outletB))
            override suspend fun banners() = GatewayResult.Sukses(BannersResponse())
            override suspend fun katalog(outletId: String) = GatewayResult.Sukses(listOf(item("m1", "Shawarma")))
        }

        val vm = CatalogViewModel(repo, outletStore, CartStore.diMemori(), lokasi = null)
        advanceUntilIdle()

        assertFalse(vm.state.value.perluPilihOutlet)
        assertTrue(vm.state.value.outletOtomatis)
        assertEquals("b", vm.state.value.outlet?.id)
        // Belum disimpan permanen sampai pelanggan mengonfirmasi atau memilih manual.
        assertNull(outletStore.idTerpilih())

        vm.konfirmasiOutletSaatIni()
        assertFalse(vm.state.value.outletOtomatis)
        assertEquals("b", outletStore.idTerpilih())
    }

    @Test
    fun `pilihOutlet membatalkan permintaan sebelumnya dan mereset kueri pencarian`() = runTest(dispatcher) {
        val outletA = outlet("a", "Outlet A")
        val outletB = outlet("b", "Outlet B")
        val katalogA = CompletableDeferred<GatewayResult<List<MenuItemDto>>>()
        val katalogB = CompletableDeferred<GatewayResult<List<MenuItemDto>>>()

        val repo = object : Repository(null) {
            override suspend fun katalog(outletId: String) =
                if (outletId == "a") katalogA.await() else katalogB.await()
        }

        val vm = CatalogViewModel(repo, OutletStore.diMemori(), CartStore.diMemori(), muatAwal = false)
        vm.ubahKueri("keju")
        vm.pilihOutlet(outletA)
        dispatcher.scheduler.runCurrent()

        vm.pilihOutlet(outletB)
        dispatcher.scheduler.runCurrent()

        // Outlet B selesai duluan, baru A selesai belakangan (tidak boleh menimpa B).
        katalogB.complete(GatewayResult.Sukses(listOf(item("mb", "Menu B"))))
        dispatcher.scheduler.runCurrent()
        katalogA.complete(GatewayResult.Sukses(listOf(item("ma", "Menu A"))))
        advanceUntilIdle()

        assertEquals("b", vm.state.value.outlet?.id)
        assertEquals(listOf("mb"), vm.state.value.semuaItem.map { it.id })
        assertEquals("", vm.state.value.kueri)
    }
}
