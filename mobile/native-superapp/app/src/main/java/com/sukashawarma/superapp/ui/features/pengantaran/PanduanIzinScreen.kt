package com.sukashawarma.superapp.ui.features.pengantaran

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat

private val MEREK_AUTOSTART = setOf("xiaomi", "redmi", "poco", "oppo", "realme", "vivo")

fun punyaIzinLokasi(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

private fun punyaIzinNotifikasi(context: Context) =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

private fun bebasOptimasiBaterai(context: Context) =
    (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName)

/**
 * Panduan sekali-jalan sebelum Berangkat pertama (HP pribadi):
 * izin lokasi, notifikasi, pengecualian optimasi baterai, dan Autostart
 * untuk merek yang agresif mematikan service.
 */
@SuppressLint("BatteryLife")
@Composable
fun PanduanIzinScreen(onSelesai: () -> Unit) {
    val context = LocalContext.current
    var segar by remember { mutableIntStateOf(0) } // memaksa cek ulang setelah kembali dari pengaturan
    val izinLokasi = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { segar++ }
    val izinNotif = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { segar++ }
    val bukaPengaturan = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { segar++ }

    @Suppress("UNUSED_EXPRESSION") segar
    val lokasiOk = punyaIzinLokasi(context)
    val notifOk = punyaIzinNotifikasi(context)
    val bateraiOk = bebasOptimasiBaterai(context)
    val perluAutostart = Build.MANUFACTURER.lowercase() in MEREK_AUTOSTART

    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Siapkan HP untuk pengantaran", fontSize = 20.sp, fontWeight = FontWeight.Black)
        Text(
            "Lokasi hanya dikirim selama perjalanan berjalan dan mati otomatis setelah selesai (paling lambat 21:00).",
            fontSize = 13.sp,
        )

        Langkah("1. Izin lokasi", lokasiOk, "Izinkan") { izinLokasi.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Langkah("2. Izin notifikasi (penanda sedang dilacak)", notifOk, "Izinkan") {
                izinNotif.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        Langkah("3. Jangan batasi baterai untuk aplikasi ini", bateraiOk, "Buka pengaturan") {
            bukaPengaturan.launch(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
            )
        }
        if (perluAutostart) {
            Langkah(
                "4. Aktifkan Autostart / \"Tanpa batasan\" di pengaturan aplikasi (${Build.MANUFACTURER})",
                null,
                "Buka info aplikasi",
            ) {
                bukaPengaturan.launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
            }
        }

        Spacer(Modifier.height(8.dp))
        Button(onClick = onSelesai, enabled = lokasiOk, modifier = Modifier.fillMaxWidth()) {
            Text(if (lokasiOk) "Lanjut" else "Izin lokasi wajib")
        }
    }
}

@Composable
private fun Langkah(judul: String, selesai: Boolean?, tombol: String, aksi: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                (if (selesai == true) "✓ " else "") + judul,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
            )
            if (selesai != true) OutlinedButton(onClick = aksi) { Text(tombol) }
        }
    }
}
