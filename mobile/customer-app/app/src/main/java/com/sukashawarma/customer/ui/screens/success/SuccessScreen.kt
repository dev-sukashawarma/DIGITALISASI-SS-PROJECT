package com.sukashawarma.customer.ui.screens.success

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar 12 - pesanan berhasil.
 *
 * Nomor pesanan ditampilkan sebesar mungkin: itu satu-satunya hal yang
 * dibutuhkan pelanggan saat berdiri di depan kasir.
 *
 * Nomor ini `orders.order_number` -- berurutan per outlet, diisi trigger
 * database, dan sudah dipakai kasir sehari-hari. Tidak ada kode ambil
 * terpisah; versi awal rencana punya kode 4 digit sendiri, tapi itu nomor
 * kedua untuk pesanan yang sudah punya nomor, dan ia bertabrakan.
 *
 * **Panjang nomor tidak dipatok.** `order_number` tumbuh seiring waktu dan
 * outlet ramai bisa mencapai lima digit, jadi ukuran fontnya menyusut
 * mengikuti panjang alih-alih memaksa tata letak yang pecah.
 *
 * **Tidak ada QR.** Artboard memuatnya, tapi tidak ada jalur pemindaian di
 * sisi kasir: POS tidak punya fitur memindai kode pesanan. QR yang tak bisa
 * dipindai siapa pun bukan sekadar mubazir -- ia menjanjikan cara kerja yang
 * tidak ada, dan pelanggan akan menyodorkan layarnya ke kasir yang kebingungan.
 */
@Composable
fun SuccessScreen(
    nomorPesanan: Int?,
    namaOutlet: String?,
    onLihatStatus: () -> Unit,
    onKembaliKeKatalog: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
        ) {
            Text(
                "Pembayaran diterima",
                style = MaterialTheme.typography.headlineSmall,
                textAlign = TextAlign.Center
            )

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                color = SukaTint
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "Nomor pesananmu",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        nomorPesanan?.toString() ?: "-",
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontSize = ukuranNomor(nomorPesanan)
                        ),
                        textAlign = TextAlign.Center
                    )
                    namaOutlet?.let {
                        Text(
                            it,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Text(
                "Sebutkan nomor ini di kasir saat mengambil pesanan.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Button(onClick = onLihatStatus, modifier = Modifier.fillMaxWidth()) {
                Text("Lihat status pesanan")
            }
            OutlinedButton(onClick = onKembaliKeKatalog, modifier = Modifier.fillMaxWidth()) {
                Text("Kembali ke menu")
            }
        }
    }
}

/**
 * Ukuran font nomor pesanan, menyusut mengikuti panjangnya.
 *
 * Nomor tumbuh seiring waktu: outlet ramai bisa mencapai lima digit atau
 * lebih. Ukuran tetap akan memotong angkanya -- persis satu-satunya informasi
 * yang benar-benar dibutuhkan pelanggan.
 */
private fun ukuranNomor(nomor: Int?) = when ((nomor?.toString()?.length ?: 1)) {
    in 0..4 -> 88.sp
    5 -> 72.sp
    6 -> 60.sp
    else -> 48.sp
}
