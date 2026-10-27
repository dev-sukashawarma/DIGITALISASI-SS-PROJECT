package com.sukashawarma.superapp.ui.features.pengantaran

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AntreanTitikTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun t(ms: Long) = Titik(lat = -6.6, lng = 106.8, waktuMs = ms)

    @Test
    fun tambahAmbilHapusUrutTertua() {
        val q = AntreanTitik(tmp.newFile("q.jsonl"))
        q.tambah(t(1)); q.tambah(t(2)); q.tambah(t(3))
        assertEquals(listOf(1L, 2L), q.ambil(2).map { it.waktuMs })
        q.hapus(2)
        assertEquals(1, q.jumlah())
        assertEquals(listOf(3L), q.ambil().map { it.waktuMs })
    }

    @Test
    fun barisRusakDilewati() {
        val f = tmp.newFile("q.jsonl")
        val q = AntreanTitik(f)
        q.tambah(t(1))
        f.appendText("{bukan json\n")
        q.tambah(t(2))
        assertEquals(listOf(1L, 2L), q.ambil().map { it.waktuMs })
    }

    @Test
    fun bertahanSaatProsesMati() {
        val f = tmp.newFile("q.jsonl")
        AntreanTitik(f).apply { tambah(t(1)); tambah(t(2)) }
        val baru = AntreanTitik(f) // instance baru = proses dimulai ulang
        assertEquals(2, baru.jumlah())
        baru.hapus(1)
        assertEquals(listOf(2L), AntreanTitik(f).ambil().map { it.waktuMs })
    }

    @Test
    fun hapusLebihDariIsiAman() {
        val q = AntreanTitik(tmp.newFile("q.jsonl"))
        q.tambah(t(1))
        q.hapus(5)
        assertEquals(0, q.jumlah())
    }
}
