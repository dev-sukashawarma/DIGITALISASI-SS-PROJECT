package com.sukashawarma.customer.ui.screens.payment

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar 11 - menunggu pembayaran.
 *
 * **Tidak ada layar "Pilih Metode" terpisah (layar 10).** Halaman tagihan
 * Xendit menyajikan pemilih metodenya sendiri -- QRIS, e-wallet, VA -- jadi
 * layar pemilih di aplikasi hanya menambah satu ketukan untuk menampilkan
 * daftar yang sama dua kali. Kalau ternyata halaman Xendit yang dipakai outlet
 * TIDAK menampilkan pemilih itu, layar 10 perlu dihidupkan kembali; itu
 * terlihat pada transaksi nyata pertama di pilot.
 *
 * Halaman pembayaran dibuka dengan **Custom Tabs**, bukan WebView sendiri:
 * halaman itu memuat 3-D Secure dan melompat ke aplikasi e-wallet, dan
 * WebView buatan sendiri sering memblokir keduanya tanpa pesan apa pun.
 */
@Composable
fun PaymentWaitScreen(
    viewModel: PaymentViewModel,
    onSelesai: (nomorPesanan: Int?) -> Unit,
    onKembaliKeRingkasan: () -> Unit,
    onLihatRiwayat: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Halaman pembayaran dibuka SEKALI per URL. Tanpa penjaga ini, setiap
    // penggambaran ulang membuka tab baru dan pelanggan tertimbun jendela.
    var urlTerbuka by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.paymentUrl) {
        val url = state.paymentUrl
        if (url != null && url != urlTerbuka) {
            urlTerbuka = url
            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
        }
    }

    LaunchedEffect(state.dibayar) {
        if (state.dibayar) onSelesai(state.nomorPesanan)
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
            when {
                state.memuat || state.menungguKonfirmasi -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(36.dp),
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        if (state.memuat) "Menyiapkan pembayaran" else "Menunggu konfirmasi pembayaran",
                        style = MaterialTheme.typography.titleMedium,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        "Jangan tutup halaman ini dulu. Kami menunggu kabar dari " +
                            "penyedia pembayaran, bukan menebak sendiri.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }

                state.gagalBayar -> {
                    Text("Pembayaran gagal", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Pembayaran tidak jadi diproses. Keranjangmu masih utuh.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Button(onClick = onKembaliKeRingkasan, modifier = Modifier.fillMaxWidth()) {
                        Text("Kembali ke ringkasan")
                    }
                }

                state.kadaluarsa -> {
                    Text("Batas waktu habis", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Pesanan tidak jadi dibuat karena belum dibayar tepat waktu. " +
                            "Keranjangmu masih utuh dan bisa dipesan ulang.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Button(onClick = onKembaliKeRingkasan, modifier = Modifier.fillMaxWidth()) {
                        Text("Kembali ke ringkasan")
                    }
                }

                state.waktuHabis -> {
                    // Berhenti menunggu TIDAK sama dengan gagal. Pembayaran
                    // bisa saja sudah masuk dan webhooknya terlambat, jadi
                    // pelanggan diarahkan memeriksa -- bukan membayar lagi.
                    Text("Belum ada kabar", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Kami belum menerima konfirmasi. Kalau uangmu sudah terpotong, " +
                            "pesanan tetap masuk -- periksa di Riwayat. Jangan membayar lagi.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Button(onClick = onLihatRiwayat, modifier = Modifier.fillMaxWidth()) {
                        Text("Lihat riwayat")
                    }
                    state.orderId?.let { id ->
                        OutlinedButton(
                            onClick = { viewModel.tanyaSampaiPasti(id) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Periksa lagi")
                        }
                    }
                }

                else -> {
                    Text("Siap membayar", style = MaterialTheme.typography.headlineSmall)
                    Button(onClick = viewModel::bayar, modifier = Modifier.fillMaxWidth()) {
                        Text("Buka halaman pembayaran")
                    }
                }
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
        }
    }
}
