package com.sukashawarma.customer.ui.screens.closed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Jam buka outlet. Nilai tetap DARI SISI APLIKASI.
 *
 * Gateway tidak menyimpan jam buka-tutup harian: `outlets.is_active` hanya
 * berarti "outlet beroperasi", bukan "sedang buka jam ini". Angka di bawah
 * adalah kesepakatan operasional (outlet buka jam 14:00), bukan data server.
 * Begitu sumber data jam buka tersedia, ganti konstanta ini dengan nilai dari
 * gateway -- jangan menambah tebakan kedua di tempat lain.
 */
private const val JAM_BUKA_OPERASIONAL = "14:00"

/**
 * Layar 16 — outlet belum melayani pesanan aplikasi.
 *
 * Keranjang TIDAK dikosongkan di sini. Menghapus keranjang pelanggan karena
 * outletnya kebetulan tutup adalah menghukum pelanggan atas keadaan yang
 * bukan salahnya.
 */
@Composable
fun OutletClosedScreen(
    namaOutlet: String,
    onGantiOutlet: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
    ) {
        Text(
            "Outlet buka jam $JAM_BUKA_OPERASIONAL",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Text(
            "$namaOutlet belum melayani pesanan aplikasi saat ini. " +
                "Keranjangmu tetap kami simpan.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Button(
            onClick = onGantiOutlet,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Pilih outlet lain")
        }

        // Pengingat baru bisa dikirim setelah notifikasi dipasang (Task 11).
        // Tombolnya ditampilkan mati DENGAN penjelasan, bukan hidup tapi diam:
        // tombol yang ditekan lalu tidak terjadi apa-apa membuat pelanggan
        // menunggu notifikasi yang tidak akan pernah datang.
        OutlinedButton(
            onClick = {},
            enabled = false,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Ingatkan saya saat buka")
        }
        Text(
            "Pengingat belum aktif di versi ini.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}
