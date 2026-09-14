package com.sukashawarma.customer.data

import android.content.Context
import java.io.File

/** Lama splash bawaan bila belum pernah menerima pengaturan dari admin. */
const val DURASI_SPLASH_BAWAAN_MS = 3_000L
const val DURASI_SPLASH_MIN_MS = 1_000L
const val DURASI_SPLASH_MAKS_MS = 5_000L

/**
 * Keputusan splash yang bisa diuji tanpa Android.
 */
object KeputusanSplash {

    /** Dibatasi 1-5 detik; nilai tak masuk akal jatuh ke 3 detik. */
    fun batasiDurasi(ms: Long?): Long {
        if (ms == null || ms <= 0) return DURASI_SPLASH_BAWAAN_MS
        return ms.coerceIn(DURASI_SPLASH_MIN_MS, DURASI_SPLASH_MAKS_MS)
    }

    /**
     * Perlu mengunduh bila admin memasang gambar DAN (gambarnya berbeda dari
     * yang tersimpan ATAU berkasnya hilang). Berkas hilang bisa terjadi saat
     * pengaturan sudah tersimpan tapi penulisan berkas terputus.
     */
    fun perluUnduh(urlServer: String?, urlTersimpan: String?, berkasAda: Boolean): Boolean =
        urlServer != null && (urlServer != urlTersimpan || !berkasAda)

    /** Admin memilih gambar bawaan: buang gambar tersimpan. */
    fun perluHapus(urlServer: String?, urlTersimpan: String?): Boolean =
        urlServer == null && urlTersimpan != null
}

/**
 * Splash terakhir yang diterima dari admin, disimpan di HP.
 *
 * Splash tampil SEBELUM ada data dari jaringan, jadi yang ditampilkan selalu
 * simpanan dari pembukaan sebelumnya. Pengaturan baru diunduh di balik layar
 * dan baru terlihat pada pembukaan berikutnya.
 *
 * Urutan tulis disengaja: berkas ditulis ke berkas sementara, di-rename, BARU
 * alamatnya dicatat. Kalau terputus di tengah jalan, alamatnya belum tercatat
 * (atau berkasnya tak ada), jadi [KeputusanSplash.perluUnduh] mengunduh ulang,
 * bukan menampilkan gambar setengah jadi.
 */
class SplashStore(context: Context) {

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
    private val berkas = File(context.filesDir, NAMA_BERKAS)

    fun durasiMs(): Long =
        KeputusanSplash.batasiDurasi(
            if (prefs.contains(KEY_DURASI)) prefs.getLong(KEY_DURASI, DURASI_SPLASH_BAWAAN_MS) else null
        )

    fun urlTersimpan(): String? = prefs.getString(KEY_URL, null)

    /** Berkas gambar splash tersimpan, atau null bila memakai gambar bawaan APK. */
    fun berkasGambar(): File? =
        if (urlTersimpan() != null && berkas.isFile && berkas.length() > 0) berkas else null

    fun berkasAda(): Boolean = berkas.isFile && berkas.length() > 0

    fun simpanDurasi(ms: Long) {
        prefs.edit().putLong(KEY_DURASI, KeputusanSplash.batasiDurasi(ms)).apply()
    }

    fun simpanGambar(url: String, byte: ByteArray) {
        val sementara = File(berkas.parentFile, "$NAMA_BERKAS.tmp")
        sementara.writeBytes(byte)
        if (!sementara.renameTo(berkas)) {
            berkas.delete()
            if (!sementara.renameTo(berkas)) {
                sementara.delete()
                return
            }
        }
        prefs.edit().putString(KEY_URL, url).commit()
    }

    fun hapusGambar() {
        prefs.edit().remove(KEY_URL).commit()
        berkas.delete()
    }

    private companion object {
        const val FILE_NAME = "splash_aplikasi"
        const val KEY_URL = "gambar_url"
        const val KEY_DURASI = "durasi_ms"
        const val NAMA_BERKAS = "splash_gambar"
    }
}
