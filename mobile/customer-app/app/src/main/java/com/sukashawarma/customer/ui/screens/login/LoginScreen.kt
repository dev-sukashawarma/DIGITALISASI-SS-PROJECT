package com.sukashawarma.customer.ui.screens.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar 2 - masuk.
 *
 * Tombol WhatsApp **tetap punya tempatnya** di tata letak walau belum aktif:
 * ia dipasang begitu akun Meta Business disetujui, dan menghapus tempatnya
 * sekarang berarti menata ulang layar ini dua kali.
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onBerhasil: () -> Unit,
    onLihatMenu: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // Context Activity, bukan application context: Credential Manager perlu
    // menempelkan lembar akun ke jendela yang sedang tampil.
    val context = LocalContext.current

    LaunchedEffect(state.berhasil) {
        if (state.berhasil) onBerhasil()
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
        ) {
            Text(
                "Masuk",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )
            Text(
                "Dipakai untuk menyimpan pesanan dan riwayatmu.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            if (state.memuat) {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    color = MaterialTheme.colorScheme.primary
                )
            } else {
                OutlinedButton(
                    onClick = { viewModel.masukDenganGoogle(context) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Lanjutkan dengan Google")
                }

                // Tempatnya disediakan sekarang, isinya menyusul.
                OutlinedButton(
                    onClick = {},
                    enabled = false,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Lanjutkan dengan WhatsApp")
                }
                Text(
                    "Masuk lewat WhatsApp belum aktif.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }

            state.pesanGalat?.let { pesan ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.small,
                    color = SukaTint
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(pesan, style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = viewModel::bersihkanGalat) { Text("Tutup") }
                    }
                }
            }

            TextButton(onClick = onLihatMenu, modifier = Modifier.fillMaxWidth()) {
                Text("Lihat menu dulu")
            }
        }
    }
}
