package com.sukashawarma.customer.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaCard
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Rangka (placeholder) untuk layar yang isinya masih dimuat.
 *
 * Menggantikan lingkaran berputar sendirian di tengah layar kosong. Bedanya
 * bukan sekadar rasa: rangka menunjukkan BENTUK isi yang akan datang, jadi mata
 * sudah menemukan tempatnya sebelum datanya tiba, dan tata letaknya tidak
 * melompat saat isi asli menggantikannya.
 */

/** Satu kotak abu berdenyut. Bahan dasar semua rangka di bawah. */
@Composable
fun KotakRangka(
    lebar: Dp? = null,
    tinggi: Dp,
    sudut: Dp = 8.dp,
    warna: Color = SukaTint,
    modifier: Modifier = Modifier,
) {
    val transisi = rememberInfiniteTransition(label = "denyut-rangka")
    val kilau by transisi.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "kilau",
    )
    Spacer(
        modifier = (if (lebar != null) modifier.width(lebar) else modifier.fillMaxWidth())
            .height(tinggi)
            .alpha(kilau)
            .clip(RoundedCornerShape(sudut))
            .background(warna),
    )
}

/**
 * Rangka Beranda — inilah yang tampil tepat setelah splash, selagi katalog &
 * banner diambil dari gateway.
 *
 * Bentuknya sengaja mengikuti Beranda asli: kepala cokelat, kartu outlet, judul
 * bagian, dua kartu best seller berdampingan, lalu banner cerita merek.
 */
@Composable
fun RangkaBeranda(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            // Satu label untuk seluruh rangka. Tanpa ini pembaca layar akan
            // membacakan belasan kotak kosong satu per satu.
            .semantics { contentDescription = "Memuat beranda" },
    ) {
        // Kepala + kartu outlet
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp))
                .background(SukaTint)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KotakRangka(lebar = 48.dp, tinggi = 48.dp, sudut = 14.dp, warna = SukaBorder)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    KotakRangka(lebar = 180.dp, tinggi = 18.dp, warna = SukaBorder)
                    KotakRangka(lebar = 130.dp, tinggi = 12.dp, warna = SukaBorder)
                }
            }
            KotakRangka(tinggi = 64.dp, sudut = 16.dp, warna = SukaCard)
        }

        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            KotakRangka(lebar = 200.dp, tinggi = 20.dp)
            KotakRangka(lebar = 150.dp, tinggi = 12.dp)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(2) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        KotakRangka(tinggi = 82.dp, sudut = 16.dp)
                        KotakRangka(lebar = 90.dp, tinggi = 12.dp)
                        KotakRangka(tinggi = 14.dp)
                        KotakRangka(lebar = 80.dp, tinggi = 16.dp)
                    }
                }
            }

            KotakRangka(tinggi = 120.dp, sudut = 20.dp)
            KotakRangka(tinggi = 96.dp, sudut = 20.dp, warna = SukaCard)
        }
    }
}
