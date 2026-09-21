package com.sukashawarma.customer.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.R
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar Masuk — gaya "illustration style": latar krem hangat, maskot chef di
 * atas dengan hiasan konfeti, judul sapaan, lalu satu tombol utama oranye.
 *
 * Sengaja TIDAK meniru kolom email & kata sandi dari referensi desainnya.
 * Gateway hanya mengenal masuk lewat Google (`/v1/auth/google`); kolom yang
 * tampak bisa diisi tapi tidak berfungsi akan menjadi jebakan bagi pelanggan.
 *
 * Teks di atas tombol oranye memakai SukaInk, BUKAN putih: kontras putih di
 * atas SukaOrange hanya 2,3:1 (lihat ColorContrastTest).
 */
@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onBerhasil: () -> Unit,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(state.berhasil) {
        if (state.berhasil) onBerhasil()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(SukaCream)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            IlustrasiSambutan()

            Text(
                text = "Selamat Datang!",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontFamily = LilitaOne,
                    color = SukaBrown,
                    fontSize = 30.sp,
                ),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Masuk untuk memesan tanpa antre dan memantau pesananmu.",
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = SukaMuted,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                ),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 12.dp),
            )

            Spacer(Modifier.height(32.dp))

            TombolMasukGoogle(
                memuat = state.memuat,
                onKlik = { viewModel.masukDenganGoogle(context) },
            )

            state.pesanGalat?.let { pesan ->
                Spacer(Modifier.height(12.dp))
                KotakGalat(pesan = pesan, onTutup = viewModel::bersihkanGalat)
            }

            Spacer(Modifier.height(24.dp))
            PemisahAtau()
            Spacer(Modifier.height(16.dp))

            TombolWhatsAppSegera()

            Spacer(Modifier.height(28.dp))

            Text(
                text = buildAnnotatedString {
                    append("Belum punya akun? ")
                    withStyle(SpanStyle(color = SukaOrange, fontWeight = FontWeight.Bold)) {
                        append("Akun dibuat otomatis")
                    }
                    append(" saat kamu masuk dengan Google.")
                },
                style = MaterialTheme.typography.bodySmall.copy(
                    color = SukaMuted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                ),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(24.dp))
        }

        // Tombol kembali di atas ilustrasi, area sentuh 48dp.
        Box(
            modifier = Modifier
                .statusBarsPadding()
                .padding(start = 8.dp, top = 4.dp)
                .size(48.dp)
                .bounceClick(onClick = onKembali)
                .semantics {
                    contentDescription = "Kembali"
                    role = Role.Button
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = null,
                tint = SukaBrown,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

/** Maskot chef dengan hiasan konfeti di sekelilingnya. */
@Composable
private fun IlustrasiSambutan() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(300.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Hiasan murni dekoratif, digambar di belakang maskot.
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Lingkaran lembut di belakang maskot.
            drawCircle(color = SukaTint, radius = h * 0.40f, center = Offset(w * 0.5f, h * 0.56f))

            // Cincin oranye kiri atas.
            drawCircle(
                color = SukaOrange,
                radius = 16.dp.toPx(),
                center = Offset(w * 0.18f, h * 0.30f),
                style = Stroke(width = 5.dp.toPx()),
            )

            // Garis bergelombang kanan atas.
            val gelombang = Path().apply {
                val x0 = w * 0.74f
                val y0 = h * 0.22f
                val seg = 12.dp.toPx()
                moveTo(x0, y0)
                for (i in 0 until 4) {
                    val dy = if (i % 2 == 0) -8.dp.toPx() else 8.dp.toPx()
                    relativeQuadraticTo(seg / 2, dy, seg, 0f)
                }
            }
            drawPath(
                path = gelombang,
                color = SukaBrown.copy(alpha = 0.55f),
                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
            )

            // Titik-titik bulat.
            drawCircle(color = SukaOrange, radius = 7.dp.toPx(), center = Offset(w * 0.86f, h * 0.52f))
            drawCircle(color = SukaGreen.copy(alpha = 0.7f), radius = 5.dp.toPx(), center = Offset(w * 0.12f, h * 0.60f))
            drawCircle(color = SukaBrown.copy(alpha = 0.35f), radius = 4.dp.toPx(), center = Offset(w * 0.30f, h * 0.14f))

            // Kotak kecil miring.
            rotate(degrees = 20f, pivot = Offset(w * 0.82f, h * 0.78f)) {
                drawRoundRect(
                    color = SukaOrange.copy(alpha = 0.8f),
                    topLeft = Offset(w * 0.82f - 7.dp.toPx(), h * 0.78f - 7.dp.toPx()),
                    size = Size(14.dp.toPx(), 14.dp.toPx()),
                    cornerRadius = CornerRadius(3.dp.toPx()),
                )
            }
            rotate(degrees = -15f, pivot = Offset(w * 0.20f, h * 0.84f)) {
                drawRoundRect(
                    color = SukaGreen.copy(alpha = 0.55f),
                    topLeft = Offset(w * 0.20f - 5.dp.toPx(), h * 0.84f - 5.dp.toPx()),
                    size = Size(10.dp.toPx(), 10.dp.toPx()),
                    cornerRadius = CornerRadius(2.dp.toPx()),
                )
            }
        }

        Image(
            painter = painterResource(R.drawable.ilustrasi_login),
            contentDescription = "Maskot chef Suka Shawarma",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .padding(top = 32.dp)
                .size(230.dp),
        )
    }
}

/** Tombol utama oranye selebar kolom. Saat memuat, berganti jadi indikator. */
@Composable
private fun TombolMasukGoogle(memuat: Boolean, onKlik: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .then(if (memuat) Modifier else Modifier.bounceClick(scaleDown = 0.98f, onClick = onKlik))
            .semantics { role = Role.Button },
        shape = RoundedCornerShape(14.dp),
        color = SukaOrange,
        shadowElevation = 2.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (memuat) {
                CircularProgressIndicator(
                    color = SukaInk,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "Menghubungkan akun…",
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = SukaInk,
                        fontSize = 15.sp,
                    ),
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "G",
                        color = Color(0xFF4285F4),
                        fontWeight = FontWeight.Black,
                        fontSize = 14.sp,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "Masuk dengan Google",
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = SukaInk,
                        fontSize = 15.sp,
                    ),
                )
            }
        }
    }
}

/** Garis — "atau" — garis, seperti "or continue with" di referensi. */
@Composable
private fun PemisahAtau() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        HorizontalDivider(modifier = Modifier.weight(1f), color = SukaBorder)
        Text(
            text = "atau",
            style = MaterialTheme.typography.labelMedium.copy(color = SukaMuted, fontSize = 12.sp),
            modifier = Modifier.padding(horizontal = 12.dp),
        )
        HorizontalDivider(modifier = Modifier.weight(1f), color = SukaBorder)
    }
}

/**
 * Masuk lewat WhatsApp belum aktif. Ditampilkan redup dan tak bisa diketuk,
 * dengan keterangan yang jujur, bukan disembunyikan.
 */
@Composable
private fun TombolWhatsAppSegera() {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp),
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = BorderStroke(1.dp, SukaBorder),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.Phone,
                contentDescription = null,
                tint = SukaMuted,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "WhatsApp · segera hadir",
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = SukaMuted,
                    fontSize = 14.sp,
                ),
            )
        }
    }
}

@Composable
private fun KotakGalat(pesan: String, onTutup: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFFFEF2F2),
        border = BorderStroke(1.dp, Color(0xFFFCA5A5)),
    ) {
        Row(
            modifier = Modifier.padding(start = 12.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = pesan,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = Color(0xFFDC2626),
                    fontSize = 12.sp,
                ),
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onTutup) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Tutup pesan",
                    tint = Color(0xFFDC2626),
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}
