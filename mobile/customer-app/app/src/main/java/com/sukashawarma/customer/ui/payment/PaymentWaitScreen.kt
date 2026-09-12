package com.sukashawarma.customer.ui.payment

import android.net.Uri
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.ui.components.KartuQris
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.PlusJakartaSans
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint
import kotlinx.coroutines.delay

/**
 * Layar 11 - Menunggu Pembayaran QRIS ala Stitch Design System.
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
    val scrollState = rememberScrollState()

    var urlTerbuka by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.paymentUrl, state.qrString) {
        val url = state.paymentUrl
        if (state.qrString == null && url != null && url != urlTerbuka) {
            urlTerbuka = url
            bukaHalamanBayar(context, url)
        }
    }

    LaunchedEffect(state.dibayar) {
        if (state.dibayar) onSelesai(state.nomorPesanan)
    }

    // Countdown Timer 15 menit (15:00)
    var detikTersisa by remember { mutableIntStateOf(15 * 60) }
    LaunchedEffect(Unit) {
        while (detikTersisa > 0) {
            delay(1000L)
            detikTersisa--
        }
    }
    val menit = detikTersisa / 60
    val detik = detikTersisa % 60
    val formatWaktu = "%02d:%02d".format(menit, detik)

    // Animasi denyut pulsing dot
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val dotAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "dotAlpha"
    )

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = SukaCream,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .statusBarsPadding()
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .bounceClick(onClick = onKembaliKeRingkasan),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Kembali",
                            tint = SukaBrown,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Pembayaran QRIS",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaBrown,
                                fontSize = 16.sp
                            )
                        )
                        Text(
                            text = "Order-Ahead & Ambil di Outlet",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = SukaMuted,
                                fontSize = 11.sp
                            )
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Info,
                            contentDescription = "Bantuan",
                            tint = SukaBrown,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 12.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.6f)),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .navigationBarsPadding()
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Button(
                        onClick = viewModel::bayar,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .bounceClick(),
                        shape = RoundedCornerShape(26.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = SukaOrange,
                            contentColor = SukaBrown
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 3.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Refresh,
                                contentDescription = null,
                                tint = SukaBrown,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = "Cek Status Pembayaran",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaBrown,
                                    fontSize = 15.sp
                                )
                            )
                        }
                    }

                    TextButton(
                        onClick = onKembaliKeRingkasan,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Batalkan Pembayaran",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFD92D20),
                                fontSize = 12.sp
                            )
                        )
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            when {
                state.memuat || state.menungguKonfirmasi || state.qrString != null -> {
                    // 1. Timer & Waiting Status Card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder),
                        shadowElevation = 2.dp
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // Status Pill
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Color(0xFFFFF4EB),
                                border = BorderStroke(1.dp, Color(0xFFFBD9BC))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .alpha(dotAlpha)
                                            .clip(CircleShape)
                                            .background(SukaOrange)
                                    )
                                    Text(
                                        text = "Menunggu Pembayaran",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SukaBrown,
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                            }

                            Text(
                                text = "Selesaikan pembayaran dalam waktu",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = SukaMuted,
                                    fontSize = 12.sp
                                )
                            )

                            // Countdown Box
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.padding(vertical = 4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFFFFF0E2)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Schedule,
                                        contentDescription = null,
                                        tint = SukaOrange,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Text(
                                    text = formatWaktu,
                                    style = MaterialTheme.typography.headlineMedium.copy(
                                        fontFamily = LilitaOne,
                                        color = SukaBrown,
                                        fontSize = 28.sp,
                                        letterSpacing = 1.5.sp
                                    )
                                )
                            }

                            Text(
                                text = "Kode QR otomatis kedaluwarsa setelah batas waktu habis.",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 11.sp
                                ),
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    // 2. Official QRIS Hero Card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder),
                        shadowElevation = 4.dp
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            // National QRIS Header
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = Color(0xFFD92D20)
                                    ) {
                                        Text(
                                            text = "QRIS",
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.Black,
                                                color = Color.White,
                                                fontSize = 12.sp,
                                                letterSpacing = 1.sp
                                            )
                                        )
                                    }
                                    Column {
                                        Text(
                                            text = "STANDAR PEMBAYARAN NASIONAL",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = SukaInk,
                                                fontSize = 10.sp
                                            )
                                        )
                                        Text(
                                            text = "GPN & Bank Indonesia",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color = SukaMuted,
                                                fontSize = 9.sp
                                            )
                                        )
                                    }
                                }

                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = Color(0xFFF3F4F6),
                                    border = BorderStroke(1.dp, Color(0xFFE5E7EB))
                                ) {
                                    Text(
                                        text = "GPN",
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Black,
                                            color = Color(0xFF1E40AF),
                                            fontSize = 9.sp
                                        )
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(Color(0xFFF5EADB))
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            // Merchant Title
                            Text(
                                text = "MERCHANT RESMI",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = SukaMuted,
                                    fontSize = 10.sp,
                                    letterSpacing = 0.5.sp
                                )
                            )
                            Text(
                                text = "SUKA SHAWARMA INDONESIA",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Black,
                                    color = SukaBrown,
                                    fontSize = 15.sp
                                )
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.padding(top = 2.dp, bottom = 12.dp)
                            ) {
                                Text(
                                    text = "NMID: ID1024398182901",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaMuted,
                                        fontSize = 10.sp
                                    )
                                )
                                Text("•", color = Color(0xFFD1D5DB), fontSize = 10.sp)
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Filled.Verified,
                                        contentDescription = null,
                                        tint = SukaGreen,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = "Terverifikasi",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaGreen,
                                            fontSize = 10.sp
                                        )
                                    )
                                }
                            }

                            // QRIS Code Box
                            state.qrString?.let { qr ->
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(Color.White)
                                        .border(BorderStroke(2.dp, Color(0xFFEAD7C5)), RoundedCornerShape(18.dp))
                                        .padding(8.dp)
                                ) {
                                    KartuQris(qrString = qr)
                                }
                            } ?: run {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(200.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = SukaOrange)
                                }
                            }

                            // Amount Section
                            if (state.totalTagihan > 0) {
                                Spacer(modifier = Modifier.height(14.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(1.dp)
                                        .background(Color(0xFFF5EADB))
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "Total Tagihan Pembayaran",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaMuted,
                                        fontSize = 11.sp
                                    )
                                )
                                Text(
                                    text = rupiah(state.totalTagihan),
                                    style = MaterialTheme.typography.headlineMedium.copy(
                                        fontFamily = LilitaOne,
                                        color = SukaBrown,
                                        fontSize = 24.sp
                                    )
                                )
                            }

                            // Fallback CustomTab Button
                            val urlCadangan = state.urlBayarTersimpan ?: state.paymentUrl
                            if (state.qrString == null && urlCadangan != null) {
                                Spacer(modifier = Modifier.height(12.dp))
                                OutlinedButton(
                                    onClick = { bukaHalamanBayar(context, urlCadangan) },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    border = BorderStroke(1.dp, SukaOrange)
                                ) {
                                    Text(
                                        "Buka Ulang Halaman Pembayaran",
                                        color = SukaBrown,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    // 3. Verification Box Alert
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFECFDF5),
                        border = BorderStroke(1.dp, Color(0xFFA7F3D0))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(
                                imageVector = Icons.Filled.CheckCircle,
                                contentDescription = null,
                                tint = SukaGreen,
                                modifier = Modifier.size(20.dp)
                            )
                            Column {
                                Text(
                                    text = "Verifikasi Pembayaran Otomatis",
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF065F46),
                                        fontSize = 13.sp
                                    )
                                )
                                Text(
                                    text = "Setelah membayar, status pesanan diperbarui otomatis. Kamu tidak perlu mengirim bukti transfer kasir.",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = Color(0xFF047857),
                                        fontSize = 11.sp,
                                        lineHeight = 15.sp
                                    ),
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }
                        }
                    }

                    // 4. Supported Banks Bar
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White.copy(alpha = 0.8f),
                        border = BorderStroke(1.dp, SukaBorder)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "MENERIMA SEMUA E-WALLET & MOBILE BANKING",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = SukaMuted,
                                    fontSize = 10.sp,
                                    letterSpacing = 0.5.sp
                                )
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                listOf("BCA", "Mandiri", "GoPay", "OVO", "ShopeePay", "DANA").forEach { bank ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color(0xFFFAF2EB),
                                        border = BorderStroke(1.dp, Color(0xFFEBD8C8))
                                    ) {
                                        Text(
                                            text = bank,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = SukaBrown,
                                                fontSize = 10.sp
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // 5. Cara Membayar
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder),
                        shadowElevation = 1.dp
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Cara Membayar dengan QRIS",
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaBrown,
                                        fontSize = 13.sp
                                    )
                                )
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color(0xFFFFF5EC)
                                ) {
                                    Text(
                                        text = "4 Langkah",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaOrange,
                                            fontSize = 10.sp
                                        )
                                    )
                                }
                            }

                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF5EADB)))

                            PanduanStep(
                                no = "1",
                                deskripsi = "Buka aplikasi mobile banking (BCA, Mandiri, BRI, Livin) atau e-Wallet (GoPay, OVO, ShopeePay, DANA)."
                            )
                            PanduanStep(
                                no = "2",
                                deskripsi = "Pilih menu \"Scan\" atau \"Bayar\" lalu arahkan kamera ke kode QR di atas."
                            )
                            PanduanStep(
                                no = "3",
                                deskripsi = "Periksa nama merchant SUKA SHAWARMA dan pastikan nominal sesuai total pesanan."
                            )
                            PanduanStep(
                                no = "4",
                                deskripsi = "Masukkan PIN keamanan Anda dan konfirmasi pembayaran hingga selesai."
                            )
                        }
                    }
                }

                state.gagalBayar -> {
                    StatusCardState(
                        judul = "Pembayaran Tidak Berhasil",
                        keterangan = "Pembayaran ditolak atau dibatalkan. Keranjangmu masih tersimpan.",
                        onAksiUtama = viewModel::bayar,
                        labelUtama = "Coba Bayar Lagi",
                        onAksiKedua = onKembaliKeRingkasan,
                        labelKedua = "Kembali ke Ringkasan"
                    )
                }

                state.kadaluarsa -> {
                    StatusCardState(
                        judul = "Batas Waktu Habis",
                        keterangan = "Batas waktu pesanan ini sudah lewat. Tekan di bawah untuk membuat pembayaran baru.",
                        onAksiUtama = viewModel::bayar,
                        labelUtama = "Buat Pembayaran Baru",
                        onAksiKedua = onKembaliKeRingkasan,
                        labelKedua = "Kembali ke Ringkasan"
                    )
                }

                state.waktuHabis -> {
                    StatusCardState(
                        judul = "Belum Ada Kabar dari Bank",
                        keterangan = "Kalau kamu sudah membayar, pesananmu sedang diproses di kasir — cek riwayat beberapa saat lagi. Kalau belum, coba bayar lagi.",
                        onAksiUtama = onLihatRiwayat,
                        labelUtama = "Cek Riwayat Pesanan",
                        onAksiKedua = viewModel::bayar,
                        labelKedua = "Coba Bayar Lagi"
                    )
                }

                state.pesanGalat != null -> {
                    StatusCardState(
                        judul = "Terjadi Kendala",
                        keterangan = state.pesanGalat!!,
                        onAksiUtama = viewModel::bayar,
                        labelUtama = "Coba Lagi",
                        onAksiKedua = onKembaliKeRingkasan,
                        labelKedua = "Kembali ke Ringkasan"
                    )
                }

                else -> {
                    Button(
                        onClick = viewModel::bayar,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(25.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SukaOrange)
                    ) {
                        Text("Mulai Pembayaran", fontWeight = FontWeight.Bold, color = SukaBrown)
                    }
                }
            }
        }
    }
}

@Composable
private fun PanduanStep(no: String, deskripsi: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(SukaBrown),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = no,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 10.sp
                )
            )
        }
        Text(
            text = deskripsi,
            style = MaterialTheme.typography.bodySmall.copy(
                color = SukaInk,
                fontSize = 12.sp,
                lineHeight = 16.sp
            ),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun StatusCardState(
    judul: String,
    keterangan: String,
    onAksiUtama: () -> Unit,
    labelUtama: String,
    onAksiKedua: () -> Unit,
    labelKedua: String
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = Color.White,
        border = BorderStroke(1.dp, SukaBorder),
        shadowElevation = 3.dp
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = judul,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontFamily = LilitaOne,
                    color = SukaBrown,
                    fontSize = 20.sp
                ),
                textAlign = TextAlign.Center
            )
            Text(
                text = keterangan,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = SukaMuted,
                    fontSize = 13.sp
                ),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(6.dp))
            Button(
                onClick = onAksiUtama,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .bounceClick(),
                shape = RoundedCornerShape(24.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SukaOrange)
            ) {
                Text(labelUtama, fontWeight = FontWeight.ExtraBold, color = SukaBrown)
            }
            TextButton(
                onClick = onAksiKedua,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(labelKedua, fontWeight = FontWeight.Bold, color = SukaMuted)
            }
        }
    }
}

private fun bukaHalamanBayar(context: android.content.Context, url: String) {
    val warnaKustom = CustomTabColorSchemeParams.Builder()
        .setToolbarColor(SukaBrown.toArgb())
        .build()
    val intent = CustomTabsIntent.Builder()
        .setDefaultColorSchemeParams(warnaKustom)
        .setShowTitle(true)
        .build()
    intent.launchUrl(context, Uri.parse(url))
}
