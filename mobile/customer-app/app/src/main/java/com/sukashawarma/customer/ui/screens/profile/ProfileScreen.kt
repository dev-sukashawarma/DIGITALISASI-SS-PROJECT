package com.sukashawarma.customer.ui.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.sukashawarma.customer.data.SessionData
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar 15 - profil.
 *
 * **Read-only, dan itu bukan pilihan gaya.** Gateway tidak punya endpoint
 * untuk mengubah profil sama sekali (`/api/v1/` hanya berisi auth, catalog,
 * checkout, orders, outlets). Rencana mengasumsikan ada endpoint yang
 * memvalidasi bentuk nomor HP di server; endpoint itu tidak pernah dibuat.
 *
 * Kolom nomor HP yang bisa diketik tapi tidak bisa disimpan ke mana pun akan
 * membuat pelanggan mengira nomornya tersimpan. Jadi tidak dibuat sampai
 * gateway benar-benar punya tempat menyimpannya.
 *
 * Spanduk "nomor belum ditambahkan" tetap ada sesuai artboard, TAPI tidak
 * menghalangi apa pun -- nomor bersifat opsional di Tahap 1 dan baru wajib
 * untuk pembayaran referral di Tahap 3.
 */
@Composable
fun ProfileScreen(
    sesi: SessionData?,
    onKeluar: () -> Unit,
    onLihatRiwayat: () -> Unit,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onKembali) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                }
                Text("Profil", style = MaterialTheme.typography.headlineSmall)
            }

            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Baris("Nama", sesi?.nama ?: "Belum ada nama")
                Baris("Email", sesi?.email ?: "Belum ada email")
                Baris("Nomor HP", sesi?.telepon ?: "Belum ditambahkan")

                if (sesi?.telepon.isNullOrBlank()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.small,
                        color = SukaTint
                    ) {
                        Text(
                            "Nomor HP belum ditambahkan. Tidak wajib untuk memesan; " +
                                "nanti diperlukan kalau kamu ikut program referral.",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }

                OutlinedButton(onClick = onLihatRiwayat, modifier = Modifier.fillMaxWidth()) {
                    Text("Riwayat pesanan")
                }
                OutlinedButton(onClick = onKeluar, modifier = Modifier.fillMaxWidth()) {
                    Text("Keluar")
                }
            }
        }
    }
}

@Composable
private fun Baris(label: String, nilai: String) {
    Column {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(nilai, style = MaterialTheme.typography.bodyLarge)
    }
}
