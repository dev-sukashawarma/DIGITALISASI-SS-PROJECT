package com.sukashawarma.customer.ui.config

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.sukashawarma.customer.data.api.ConfigDto

/** Config gagal dimuat -> TIDAK memaksa update: pelanggan tak boleh terkunci karena jaringan. */
fun perluUpdate(versiTerpasang: Int, config: ConfigDto?): Boolean =
    config != null && versiTerpasang < config.versiMinimumAndroid

/** Config yang sedang berlaku; bawaan dipakai sampai/bila gateway gagal. */
val LocalConfigApp = staticCompositionLocalOf { ConfigDto() }

@Composable
fun LayarPerbaruiAplikasi() {
    val konteks = LocalContext.current
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Perbarui aplikasi", style = MaterialTheme.typography.titleLarge)
        Text(
            "Versi aplikasi ini sudah tidak didukung. Perbarui dari Play Store untuk lanjut memesan.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
        Button(onClick = {
            konteks.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=${konteks.packageName}"))
            )
        }) { Text("Buka Play Store") }
    }
}
