package com.sukashawarma.customer.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.data.SessionData
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Halaman Informasi Akun — hanya-baca.
 *
 * Nama & email berasal dari akun Google dan diperbarui gateway setiap kali
 * pelanggan masuk; belum ada endpoint untuk mengubahnya dari aplikasi. Jadi
 * halaman ini tidak menampilkan kolom yang tampak bisa disunting, dan
 * menjelaskan terus terang dari mana datanya berasal.
 *
 * Baris yang datanya kosong DISEMBUNYIKAN, tidak ditampilkan sebagai
 * "Belum diisi" -- aplikasi tak punya tempat untuk mengisinya.
 */
@Composable
fun InformasiAkunScreen(
    sesi: SessionData?,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val nama = InformasiAkun.teksAtauNull(sesi?.nama)
    val email = InformasiAkun.teksAtauNull(sesi?.email)
    val telepon = InformasiAkun.teksAtauNull(sesi?.telepon)
    val inisial = remember(nama) { InformasiAkun.inisial(nama) }
    val berlaku = remember(sesi?.expiresAt) { InformasiAkun.formatBerlakuSampai(sesi?.expiresAt) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Informasi Akun",
                subjudul = "Data akun pelangganmu",
                onKembali = onKembali,
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Kartu identitas
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder),
            ) {
                Column(
                    modifier = Modifier.padding(vertical = 24.dp, horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(SukaOrange),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = inisial,
                            style = MaterialTheme.typography.headlineSmall.copy(
                                fontFamily = LilitaOne,
                                color = SukaInk,
                                fontSize = 28.sp,
                            ),
                        )
                    }
                    Text(
                        text = nama ?: "Pelanggan Suka Shawarma",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaBrown,
                            fontSize = 20.sp,
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (email != null) {
                        Text(
                            text = email,
                            style = MaterialTheme.typography.bodyMedium.copy(color = SukaMuted, fontSize = 14.sp),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }

            JudulBagian("DATA AKUN")
            KartuBaris {
                BarisInfo(Icons.Filled.Person, "Nama", nama ?: "—")
                if (email != null) {
                    Pemisah()
                    BarisInfo(Icons.Filled.Email, "Email", email)
                }
                if (telepon != null) {
                    Pemisah()
                    BarisInfo(Icons.Filled.Phone, "Nomor HP", telepon)
                }
                Pemisah()
                BarisInfo(Icons.Filled.Lock, "Masuk dengan", "Akun Google")
            }

            if (berlaku != null) {
                JudulBagian("SESI")
                KartuBaris {
                    BarisInfo(Icons.Filled.Schedule, "Sesi berlaku sampai", berlaku)
                }
            }

            // Keterangan asal data
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = SukaTint,
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Filled.Info,
                        contentDescription = null,
                        tint = SukaBrown,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = "Nama dan email diambil dari akun Google-mu dan diperbarui setiap kali kamu masuk. " +
                            "Untuk mengubahnya, ubah di pengaturan akun Google, lalu keluar dan masuk lagi.",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaInk,
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                        ),
                    )
                }
            }
        }
    }
}

@Composable
private fun JudulBagian(teks: String) {
    Text(
        text = teks,
        style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = FontWeight.Black,
            color = SukaMuted,
            fontSize = 11.sp,
            letterSpacing = 0.5.sp,
        ),
        modifier = Modifier.padding(horizontal = 4.dp),
    )
}

@Composable
private fun KartuBaris(isi: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        border = BorderStroke(1.dp, SukaBorder),
    ) {
        Column { isi() }
    }
}

@Composable
private fun Pemisah() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .height(1.dp)
            .background(Color(0xFFF8EFE7)),
    )
}

@Composable
private fun BarisInfo(ikon: ImageVector, label: String, nilai: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(SukaTint),
            contentAlignment = Alignment.Center,
        ) {
            Icon(imageVector = ikon, contentDescription = null, tint = SukaBrown, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall.copy(color = SukaMuted, fontSize = 12.sp),
            )
            Text(
                text = nilai,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = SukaInk,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
