package com.sukashawarma.superapp.ui.features.pengantaran

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

/** Keadaan pengiriman posisi, ditampilkan sebagai banner di layar perjalanan. */
data class StatusKirim(val terakhirTerkirimMs: Long? = null, val menunggu: Int = 0, val aktif: Boolean = false)

/**
 * Foreground service lokasi selama perjalanan berjalan. Dimulai dari tombol
 * "Berangkat" (layar terbuka), jadi cukup izin lokasi "saat aplikasi digunakan".
 * Titik → FilterTitik → AntreanTitik (berkas) → PengirimAntrean.
 * Berhenti sendiri saat server melaporkan perjalanan bukan lagi `berjalan`.
 */
class PengantaranLocationService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val kirimMutex = Mutex()
    private lateinit var antrean: AntreanTitik
    private lateinit var pengirim: PengirimAntrean
    private val filter = FilterTitik(Pengaturan())
    private var titikTerakhirMasuk: Titik? = null
    private var callback: LocationCallback? = null
    private var tiba = 0
    private var total = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        antrean = AntreanTitik(fileAntrean(this))
        pengirim = PengirimAntrean(PengantaranRepository(), antrean)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            AKSI_HENTIKAN -> {
                berhenti()
                return START_NOT_STICKY
            }
            AKSI_PERBARUI -> {
                tiba = intent.getIntExtra(EXTRA_TIBA, tiba)
                total = intent.getIntExtra(EXTRA_TOTAL, total)
                tampilkanNotifikasi()
                return START_STICKY
            }
        }
        filter.pengaturan = Pengaturan(
            intervalDetik = intent?.getIntExtra(EXTRA_INTERVAL, 30) ?: 30,
            jarakMinM = intent?.getIntExtra(EXTRA_JARAK, 100) ?: 100,
        )
        tiba = intent?.getIntExtra(EXTRA_TIBA, 0) ?: 0
        total = intent?.getIntExtra(EXTRA_TOTAL, 0) ?: 0
        tampilkanNotifikasi()
        mulaiLokasi()
        _status.value = _status.value.copy(aktif = true, menunggu = antrean.jumlah())
        return START_STICKY
    }

    private fun tampilkanNotifikasi() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel(KANAL, "Pengantaran", NotificationManager.IMPORTANCE_LOW))
        }
        val buka = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val notif: Notification = NotificationCompat.Builder(this, KANAL)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Sedang mengantar · $tiba/$total outlet")
            .setContentText("Lokasi dikirim ke pusat selama perjalanan")
            .setOngoing(true)
            .setContentIntent(buka)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(ID_NOTIF, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(ID_NOTIF, notif)
        }
    }

    @SuppressLint("MissingPermission") // izin dicek di layar sebelum service dimulai
    private fun mulaiLokasi() {
        if (callback != null) return
        val client = LocationServices.getFusedLocationProviderClient(this)
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, filter.pengaturan.intervalDetik * 1000L)
            .setMinUpdateIntervalMillis(10_000L)
            .build()
        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { loc ->
                    val t = Titik(
                        lat = loc.latitude,
                        lng = loc.longitude,
                        akurasiM = if (loc.hasAccuracy()) loc.accuracy else null,
                        kecepatanMps = if (loc.hasSpeed()) loc.speed else null,
                        arahDerajat = if (loc.hasBearing()) loc.bearing else null,
                        bateraiPersen = baterai(),
                        waktuMs = loc.time,
                    )
                    if (filter.perluKirim(t, titikTerakhirMasuk)) {
                        titikTerakhirMasuk = t
                        antrean.tambah(t)
                        kirim()
                    }
                }
            }
        }
        callback = cb
        client.requestLocationUpdates(request, cb, Looper.getMainLooper())
    }

    private fun kirim() {
        scope.launch {
            if (!kirimMutex.tryLock()) return@launch // satu pengiriman berjalan; titik baru ikut batch berikutnya
            try {
                val hasil = pengirim.kirimSemua()
                _status.value = _status.value.copy(
                    terakhirTerkirimMs = if (hasil != null) System.currentTimeMillis() else _status.value.terakhirTerkirimMs,
                    menunggu = antrean.jumlah(),
                )
                if (hasil != null) {
                    filter.pengaturan = hasil.pengaturan
                    if (hasil.statusPerjalanan != "berjalan") berhenti()
                }
            } finally {
                kirimMutex.unlock()
            }
        }
    }

    private fun baterai(): Int? =
        (getSystemService(Context.BATTERY_SERVICE) as? BatteryManager)
            ?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            ?.takeIf { it in 0..100 }

    private fun berhenti() {
        callback?.let { LocationServices.getFusedLocationProviderClient(this).removeLocationUpdates(it) }
        callback = null
        _status.value = _status.value.copy(aktif = false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        callback?.let { LocationServices.getFusedLocationProviderClient(this).removeLocationUpdates(it) }
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val KANAL = "pengantaran"
        private const val ID_NOTIF = 4201
        private const val AKSI_HENTIKAN = "pengantaran.HENTIKAN"
        private const val AKSI_PERBARUI = "pengantaran.PERBARUI"
        private const val EXTRA_INTERVAL = "interval"
        private const val EXTRA_JARAK = "jarak"
        private const val EXTRA_TIBA = "tiba"
        private const val EXTRA_TOTAL = "total"

        private val _status = MutableStateFlow(StatusKirim())
        val status: StateFlow<StatusKirim> = _status.asStateFlow()

        fun fileAntrean(context: Context) = File(context.filesDir, "pengantaran_antrean.jsonl")

        fun mulai(context: Context, pengaturan: Pengaturan, tiba: Int, total: Int) {
            val i = Intent(context, PengantaranLocationService::class.java)
                .putExtra(EXTRA_INTERVAL, pengaturan.intervalDetik)
                .putExtra(EXTRA_JARAK, pengaturan.jarakMinM)
                .putExtra(EXTRA_TIBA, tiba)
                .putExtra(EXTRA_TOTAL, total)
            ContextCompat.startForegroundService(context, i)
        }

        fun perbarui(context: Context, tiba: Int, total: Int) {
            if (!_status.value.aktif) return
            context.startService(
                Intent(context, PengantaranLocationService::class.java)
                    .setAction(AKSI_PERBARUI).putExtra(EXTRA_TIBA, tiba).putExtra(EXTRA_TOTAL, total)
            )
        }

        fun hentikan(context: Context) {
            if (!_status.value.aktif) return
            context.startService(Intent(context, PengantaranLocationService::class.java).setAction(AKSI_HENTIKAN))
        }
    }
}
