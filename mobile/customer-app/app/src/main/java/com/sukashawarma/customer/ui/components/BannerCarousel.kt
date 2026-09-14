package com.sukashawarma.customer.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.sukashawarma.customer.data.api.BannerDto
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaOrange
import kotlinx.coroutines.delay

/**
 * Rasio lebar:tinggi banner carousel. Gambar yang diunggah admin sebaiknya
 * mengikuti rasio ini (mis. 1280x640); bagian yang tidak pas terpotong rata
 * tengah, bukan diregangkan.
 */
const val RASIO_BANNER = 2f

/**
 * Carousel banner selebar layar: gambar mengisi seluruh kartu.
 *
 * SATU komponen untuk Beranda maupun tab Menu. Sebelumnya kedua layar punya
 * salinan sendiri-sendiri, dan salinan kedua itulah yang membuat voucher palsu
 * SUKABARU selamat dari tujuh task perbaikan. Mengubah tampilan banner cukup
 * di sini.
 *
 * Dipanggil hanya saat [slides] tidak kosong.
 */
@Composable
fun BannerCarousel(
    slides: List<BannerDto>,
    onKetuk: (BannerDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    val pagerState = rememberPagerState(pageCount = { slides.size })

    LaunchedEffect(pagerState, slides.size) {
        while (true) {
            delay(4500)
            if (!pagerState.isScrollInProgress && slides.size > 1) {
                pagerState.animateScrollToPage((pagerState.currentPage + 1) % slides.size)
            }
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxWidth()) { page ->
            val slide = slides[page]
            Box(
                modifier = Modifier
                    // Mentok sampai tepi layar: tanpa jarak kiri-kanan dan
                    // tanpa sudut membulat (keputusan owner 2026-09-14).
                    .fillMaxWidth()
                    .aspectRatio(RASIO_BANNER)
                    // Latar cokelat terlihat selama gambar dimuat atau bila
                    // banner tak punya gambar, jadi kartu tak pernah putih kosong.
                    .background(SukaBrown)
                    .bounceClick(scaleDown = 0.98f) { onKetuk(slide) },
            ) {
                if (slide.gambarUrl != null) {
                    AsyncImage(
                        model = slide.gambarUrl,
                        contentDescription = slide.judul,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }

                // Gradasi gelap di bagian bawah supaya teks tetap terbaca di
                // atas gambar terang sekalipun.
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                0.35f to Color.Transparent,
                                1f to Color.Black.copy(alpha = 0.72f),
                            )
                        ),
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    if (!slide.badge.isNullOrBlank()) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SukaOrange)
                                .padding(horizontal = 7.dp, vertical = 2.dp),
                        ) {
                            Text(
                                text = slide.badge,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 9.sp,
                                ),
                            )
                        }
                    }
                    Text(
                        text = slide.judul,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            fontSize = 16.sp,
                            lineHeight = 20.sp,
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!slide.subjudul.isNullOrBlank()) {
                        Text(
                            text = slide.subjudul,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color.White.copy(alpha = 0.88f),
                                fontSize = 11.sp,
                                lineHeight = 14.sp,
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (!slide.teksTombol.isNullOrBlank()) {
                        Box(
                            modifier = Modifier
                                .padding(top = 3.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(SukaOrange)
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        ) {
                            Text(
                                text = slide.teksTombol,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 11.sp,
                                color = SukaInk,
                            )
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.padding(top = 6.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            repeat(slides.size) { index ->
                val aktif = pagerState.currentPage == index
                val lebar by animateDpAsState(
                    targetValue = if (aktif) 18.dp else 5.dp,
                    animationSpec = tween(250),
                    label = "lebarTitik",
                )
                val warna by animateColorAsState(
                    targetValue = if (aktif) SukaOrange else SukaBorder.copy(alpha = 0.8f),
                    animationSpec = tween(250),
                    label = "warnaTitik",
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 2.dp)
                        .height(5.dp)
                        .width(lebar)
                        .clip(CircleShape)
                        .background(warna),
                )
            }
        }
    }
}
