package com.sukashawarma.customer.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyStore
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
        buatEncryptedPrefs(context)
    }

    private fun buatEncryptedPrefs(context: Context): SharedPreferences {
        fun bikin(): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            return EncryptedSharedPreferences.create(
                context,
                FILE_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }

        return runCatching { bikin() }.getOrElse { pertama ->
            Log.w(TAG, "EncryptedSharedPreferences gagal dibuka, mencoba reset Keystore + file: ${pertama.message}")
            // Jika file XML lama ter-restore atau kunci AndroidKeyStore korup/dibatalkan OS,
            // hapus file prefs SEKALIGUS alias MasterKey agar tidak terjebak crash loop permanen.
            runCatching { context.deleteSharedPreferences(FILE_NAME) }
            runCatching {
                val ks = KeyStore.getInstance("AndroidKeyStore")
                ks.load(null)
                if (ks.containsAlias(MasterKey.DEFAULT_MASTER_KEY_ALIAS)) {
                    ks.deleteEntry(MasterKey.DEFAULT_MASTER_KEY_ALIAS)
                }
            }
            runCatching { bikin() }.getOrElse { kedua ->
                Log.e(TAG, "Pemulihan EncryptedSharedPreferences gagal: ${kedua.message}", kedua)
                // Darurat: prefs memori sementara agar aplikasi tidak crash loop saat startup.
                // Sesi tidak tersimpan ke disk tak terenkripsi; pelanggan cukup masuk lagi.
                MemoriSharedPreferences()
            }
        }
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
        const val TAG = "SukaSession"
        const val FILE_NAME = "suka_customer_session"
        const val KEY_TOKEN = "token"
        const val KEY_EXPIRES_AT = "expires_at"
        const val KEY_NAMA = "nama"
        const val KEY_EMAIL = "email"
        const val KEY_TELEPON = "telepon"
    }
}

/**
 * Cadangan darurat hanya di memori (tidak pernah menulis token ke disk tak
 * terenkripsi) bila AndroidKeyStore rusak parah di perangkat tertentu.
 */
private class MemoriSharedPreferences : SharedPreferences {
    private val map = LinkedHashMap<String, Any?>()
    override fun getAll(): MutableMap<String, *> = HashMap(map)
    override fun getString(key: String?, defValue: String?): String? = map[key] as? String ?: defValue
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = defValues
    override fun getInt(key: String?, defValue: Int): Int = map[key] as? Int ?: defValue
    override fun getLong(key: String?, defValue: Long): Long = map[key] as? Long ?: defValue
    override fun getFloat(key: String?, defValue: Float): Float = map[key] as? Float ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean): Boolean = map[key] as? Boolean ?: defValue
    override fun contains(key: String?): Boolean = map.containsKey(key)
    override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
        private val pending = LinkedHashMap<String, Any?>()
        private val removed = HashSet<String>()
        private var clearAll = false
        override fun putString(key: String?, value: String?) = apply { if (key != null) pending[key] = value }
        override fun putStringSet(key: String?, values: MutableSet<String>?) = this
        override fun putInt(key: String?, value: Int) = apply { if (key != null) pending[key] = value }
        override fun putLong(key: String?, value: Long) = apply { if (key != null) pending[key] = value }
        override fun putFloat(key: String?, value: Float) = apply { if (key != null) pending[key] = value }
        override fun putBoolean(key: String?, value: Boolean) = apply { if (key != null) pending[key] = value }
        override fun remove(key: String?) = apply { if (key != null) removed.add(key) }
        override fun clear() = apply { clearAll = true }
        override fun commit(): Boolean { apply(); return true }
        override fun apply() {
            if (clearAll) map.clear()
            removed.forEach { map.remove(it) }
            map.putAll(pending)
        }
    }
}

private val POLA_ISO = Regex(
    """^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*([Zz]|[+-]\d{2}(?::?\d{2})?)?$"""
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
            val (jam, menit) = when (angka.length) {
                2 -> (angka.toIntOrNull() ?: return null) to 0
                4 -> (angka.substring(0, 2).toIntOrNull() ?: return null) to
                    (angka.substring(2, 4).toIntOrNull() ?: return null)
                else -> return null
            }
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
