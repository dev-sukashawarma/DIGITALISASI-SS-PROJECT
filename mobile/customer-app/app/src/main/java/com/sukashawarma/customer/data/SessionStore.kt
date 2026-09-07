package com.sukashawarma.customer.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.text.SimpleDateFormat
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

/**
 * Mengurai `expires_at` dari gateway.
 *
 * Gateway mengirim `Date.toISOString()`: selalu UTC, selalu berformat sama.
 * `java.time` butuh API 26 sedangkan minSdk di sini 24, jadi `SimpleDateFormat`
 * yang dipakai -- dikunci ke Locale.US supaya perangkat berlokal lain tidak
 * mengubah cara angkanya dibaca.
 */
internal fun uraiWaktuIso(iso: String): Long? {
    val pola = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    return runCatching { pola.parse(iso)?.time }.getOrNull()
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
