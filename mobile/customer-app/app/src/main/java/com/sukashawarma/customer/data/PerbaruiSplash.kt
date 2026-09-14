package com.sukashawarma.customer.data

import com.sukashawarma.customer.data.api.GatewayResult

/**
 * Menyegarkan simpanan splash dari gateway, untuk pembukaan BERIKUTNYA.
 *
 * Kegagalan apa pun (jaringan, gateway 502, gambar gagal diunduh) diabaikan
 * dan simpanan lama dibiarkan utuh. Yang membuang gambar tersimpan HANYA
 * balasan sukses yang memang menyatakan admin memilih gambar bawaan.
 */
suspend fun perbaruiSplash(repository: Repository, store: SplashStore) {
    val hasil = repository.splash()
    if (hasil !is GatewayResult.Sukses) return

    val urlServer = hasil.data.gambarUrl
    store.simpanDurasi(hasil.data.durasiMs.toLong())

    if (KeputusanSplash.perluHapus(urlServer, store.urlTersimpan())) {
        store.hapusGambar()
        return
    }
    if (urlServer != null &&
        KeputusanSplash.perluUnduh(urlServer, store.urlTersimpan(), store.berkasAda())
    ) {
        repository.unduhGambarSplash(urlServer)?.let { store.simpanGambar(urlServer, it) }
    }
}
