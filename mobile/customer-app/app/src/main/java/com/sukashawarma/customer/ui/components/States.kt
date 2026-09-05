package com.sukashawarma.customer.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.sukashawarma.customer.data.api.GatewayError

@Composable
fun MemuatState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun EmptyState(
    judul: String,
    penjelasan: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(judul, style = MaterialTheme.typography.titleLarge)
        Text(
            penjelasan,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Menerjemahkan galat gateway jadi kalimat yang bisa ditindak pelanggan.
 *
 * Fungsi murni supaya bisa diuji tanpa menyalakan Compose, dan supaya tidak
 * ada layar yang diam-diam mengarang kalimatnya sendiri.
 */
fun pesanGalat(error: GatewayError): String = when (error) {
    is GatewayError.Jaringan ->
        "Tidak bisa terhubung. Periksa koneksi internetmu, lalu coba lagi."
    is GatewayError.Server ->
        "Layanan sedang bermasalah. Coba lagi sebentar lagi."
    GatewayError.SesiTidakSah ->
        "Sesimu sudah berakhir. Masuk lagi untuk melanjutkan."
    is GatewayError.Kode -> error.pesan
}

@Composable
fun ErrorState(
    error: GatewayError,
    onCobaLagi: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Gagal memuat", style = MaterialTheme.typography.titleLarge)
        Text(
            pesanGalat(error),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Button(onClick = onCobaLagi) { Text("Coba lagi") }
    }
}
