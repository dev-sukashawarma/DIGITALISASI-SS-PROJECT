package com.sukashawarma.customer.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Sesi pelanggan (token gateway) setara identitas pelanggan — WAJIB terenkripsi.
 * Jangan pernah pindah ke SharedPreferences biasa atau DataStore tanpa enkripsi.
 */
data class SessionData(
    val token: String,
    val expiresAt: String,
    val nama: String? = null,
    val email: String? = null,
    val telepon: String? = null
)

class SessionStore(context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun simpan(
        token: String,
        expiresAt: String,
        nama: String? = null,
        email: String? = null,
        telepon: String? = null
    ) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_EXPIRES_AT, expiresAt)
            .putString(KEY_NAMA, nama)
            .putString(KEY_EMAIL, email)
            .putString(KEY_TELEPON, telepon)
            .apply()
    }

    fun baca(): SessionData? {
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val expiresAt = prefs.getString(KEY_EXPIRES_AT, null) ?: return null
        return SessionData(
            token = token,
            expiresAt = expiresAt,
            nama = prefs.getString(KEY_NAMA, null),
            email = prefs.getString(KEY_EMAIL, null),
            telepon = prefs.getString(KEY_TELEPON, null)
        )
    }

    /** Apakah masih ada sesi yang layak dipakai. Lihat [sesiMasihBerlaku]. */
    fun adaSesiBerlaku(): Boolean =
        sesiMasihBerlaku(baca()?.expiresAt, System.currentTimeMillis())

    fun hapus() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_EXPIRES_AT)
            .remove(KEY_NAMA)
            .remove(KEY_EMAIL)
            .remove(KEY_TELEPON)
            .apply()
    }

    private companion object {
        const val FILE_NAME = "suka_customer_session"
        const val KEY_TOKEN = "token"
        const val KEY_EXPIRES_AT = "expires_at"
        const val KEY_NAMA = "nama"
        const val KEY_EMAIL = "email"
        const val KEY_TELEPON = "telepon"
    }
}

private val POLA_ISO = Regex(
    """^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*([Zz]|[+-]\d{2}:?\d{2})?$"""
)

/**
 * Mengurai cap waktu ISO-8601 dari gateway.
 *
 * **Gateway mengirim DUA bentuk berbeda**, dan versi pertama fungsi ini hanya
 * mengenali satu:
 *
 *   - `2026-09-07T03:23:34.097Z`        <- dari `Date.toISOString()` (JS),
 *                                          dipakai `expires_at` sesi login
 *   - `2026-09-07T10:23:34.097+07:00`   <- dari kolom `timestamptz` lewat
 *                                          PostgREST, dipakai `expires_at`
 *                                          dan `created_at` pesanan
 *
 * Pola lama `...HH:mm:ss.SSS'Z'` menolak bentuk kedua, dan kegagalannya
 * SENYAP: penelepon memperlakukan null sebagai "tidak diketahui" lalu memilih
 * jalur aman. Akibat nyatanya, aplikasi memantau pesanan yang sudah
 * kedaluwarsa alih-alih membuat yang baru -- pelanggan menonton pemuat
 * selamanya dan tidak pernah bisa membayar.
 *
 * Pecahan detik juga bervariasi: PostgREST mengirim mikrodetik (6 digit)
 * untuk sebagian kolom dan milidetik (3 digit) untuk yang lain.
 *
 * `java.time` butuh API 26 sedangkan minSdk di sini 24, jadi penguraiannya
 * dilakukan sendiri lewat regex + `Calendar` UTC.
 */
internal fun uraiWaktuIso(iso: String): Long? {
    val m = POLA_ISO.find(iso.trim()) ?: return null
    val (th, bl, hr, jj, mm, dd, pecahan, offset) = m.destructured

    val kal = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US).apply {
        isLenient = false
        clear()
        set(th.toInt(), bl.toInt() - 1, hr.toInt(), jj.toInt(), mm.toInt(), dd.toInt())
    }

    val milidetik = runCatching {
        // Ambil tiga digit pertama; sisanya (mikrodetik) dibuang, bukan
        // dianggap gagal. Angka lebih pendek dari tiga digit di-pad.
        if (pecahan.isEmpty()) 0 else pecahan.padEnd(3, '0').take(3).toInt()
    }.getOrElse { 0 }

    val epochUtc = runCatching { kal.timeInMillis }.getOrNull() ?: return null

    // Offset kosong diperlakukan sebagai UTC. Itu tebakan, tapi satu-satunya
    // yang masuk akal -- dan tidak pernah terjadi pada data dari gateway ini.
    val geser = when {
        offset.isEmpty() || offset.equals("Z", ignoreCase = true) -> 0L
        else -> {
            val tanda = if (offset[0] == '-') -1 else 1
            val angka = offset.substring(1).replace(":", "")
            if (angka.length != 4) return null
            val jam = angka.substring(0, 2).toIntOrNull() ?: return null
            val menit = angka.substring(2, 4).toIntOrNull() ?: return null
            tanda * (jam * 60L + menit) * 60_000L
        }
    }

    return epochUtc + milidetik - geser
}

/**
 * Apakah sesi masih layak dipakai.
 *
 * Pemeriksaan ini HANYA kemudahan untuk melewati layar masuk. **Gateway tetap
 * satu-satunya penentu** sah atau tidaknya sesi: jam perangkat bisa salah dan
 * token bisa dicabut lebih awal.
 *
 * Karena itu tanggal yang TIDAK BISA DIURAI dianggap masih berlaku. Biar
 * gateway yang menolak dengan 401 -- mengunci pelanggan di luar karena satu
 * string tak terbaca jauh lebih merugikan daripada satu permintaan yang
 * ditolak server.
 */
internal fun sesiMasihBerlaku(expiresAt: String?, sekarang: Long): Boolean {
    if (expiresAt == null) return false
    val kedaluwarsa = uraiWaktuIso(expiresAt) ?: return true
    return kedaluwarsa > sekarang
}
