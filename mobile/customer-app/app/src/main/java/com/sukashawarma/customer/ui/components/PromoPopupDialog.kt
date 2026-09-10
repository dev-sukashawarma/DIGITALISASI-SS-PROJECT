package com.sukashawarma.customer.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange

private const val DEFAULT_PROMO_IMAGE_URL =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA-1VF8-8QaQcQ6cmXMurD2EvPHrP2j_cotf5LxDsJhsuHPuzbmNqUIielgYlF8F6zj-wa6sSNP2qdPHdpAkVGLwdkzt2_BoWryJbpIB1MPcnS5KC7Qnsur5QBCCh423OYZcFRPeAFQjjMueVERE8RO6POhDbXSkNX2DUnw82HsiYONuRZKXQbD0T6tbEiGGpqIqxxfRtTj4c0-JjhF44ih-HJwp52RRjdcrpTccNHx45kRZYTRG7iz8v5fQipfTNnWM96x1AEo0WuL"

/**
 * Dialog Popup Promo Placeholder yang muncul sebelum beranda / di atas beranda.
 * Menampilkan poster promo visual, voucher eksklusif, serta tombol CTA langsung ke Menu.
 */
@Composable
fun PromoPopupDialog(
    onDismiss: () -> Unit,
    onKlaimPromo: () -> Unit,
    modifier: Modifier = Modifier,
    imageUrl: String = DEFAULT_PROMO_IMAGE_URL,
    badgeText: String = "🔥 PROMO SPESIAL HARI INI",
    judul: String = "Diskon 40% Pengguna Baru!",
    subjudul: String = "Nikmati kelezatan Shawarma Panggang Otentik dengan potongan spesial. Daging berlimpah, saus garlic toum gurih!",
    kodeVoucher: String = "SUKABARU",
    infoDiskon: String = "Potongan s.d. Rp 25.000"
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            contentAlignment = Alignment.Center
        ) {
            // Kontainer Dialog Card
            Surface(
                modifier = modifier.fillMaxWidth(),
                shape = RoundedCornerShape(26.dp),
                color = SukaCream,
                shadowElevation = 16.dp,
                border = BorderStroke(1.5.dp, SukaOrange.copy(alpha = 0.35f))
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Header Gambar Poster & Tombol Close
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(190.dp)
                            .clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp))
                    ) {
                        // Background gradient placeholder jika gambar memuat
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        listOf(SukaBrown, Color(0xFF4A0E03))
                                    )
                                )
                        )

                        // Gambar Poster Promo
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = "Promo Banner",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )

                        // Subtle dark gradient vignette di bagian atas untuk visibilitas tombol close
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(60.dp)
                                .background(
                                    Brush.verticalGradient(
                                        listOf(
                                            Color.Black.copy(alpha = 0.55f),
                                            Color.Transparent
                                        )
                                    )
                                )
                        )

                        // Floating Promo Badge di kiri atas
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(12.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(SukaOrange)
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Text(
                                text = badgeText,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Black,
                                    color = SukaInk,
                                    fontSize = 10.sp,
                                    letterSpacing = 0.5.sp
                                )
                            )
                        }

                        // Circular Close Button di kanan atas
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(10.dp)
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.6f))
                                .clickable(onClick = onDismiss),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Tutup",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    // Body Konten Promo
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Judul Promo
                        Text(
                            text = judul,
                            fontFamily = LilitaOne,
                            fontSize = 22.sp,
                            color = SukaInk,
                            textAlign = TextAlign.Center,
                            lineHeight = 26.sp
                        )

                        // Deskripsi Promo
                        Text(
                            text = subjudul,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color(0xFF6B5548),
                                fontSize = 12.sp,
                                lineHeight = 17.sp,
                                textAlign = TextAlign.Center
                            ),
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )

                        // Box Kode Voucher
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0xFFFFF0E0),
                            border = BorderStroke(1.dp, SukaOrange.copy(alpha = 0.5f))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "KODE VOUCHER",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = SukaMuted,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 9.sp,
                                            letterSpacing = 0.5.sp
                                        )
                                    )
                                    Text(
                                        text = kodeVoucher,
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SukaBrown,
                                            fontSize = 15.sp,
                                            letterSpacing = 1.sp
                                        )
                                    )
                                }

                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(SukaOrange.copy(alpha = 0.2f))
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = infoDiskon,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaBrown,
                                            fontSize = 10.sp
                                        )
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(2.dp))

                        // Tombol Utama CTA (Pesan / Klaim)
                        Button(
                            onClick = onKlaimPromo,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SukaOrange,
                                contentColor = SukaInk
                            ),
                            shape = RoundedCornerShape(14.dp),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
                        ) {
                            Text(
                                text = "Klaim & Pesan Sekarang ➔",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp
                                )
                            )
                        }

                        // Tombol Nanti Saja / Dismiss
                        Text(
                            text = "Nanti Saja",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = SukaMuted,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp
                            ),
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .clickable(onClick = onDismiss)
                                .padding(horizontal = 12.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
