package com.sukashawarma.customer.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Gradient latar belakang khas SukaBrown untuk seluruh Header Brand.
 */
private val SukaBrandHeaderGradient = Brush.verticalGradient(
    listOf(
        Color(0xFF4A0E03),
        SukaBrown,
        Color(0xFF5E1203)
    )
)

/**
 * 1. Header Beranda Brand Heritage (HomeBrandHeader).
 * Ramping, elegan, dan proporsional (~118dp) agar tidak memotong kartu Best Seller di bawahnya.
 */
@Composable
fun HomeBrandHeader(
    namaOutlet: String,
    buka: Boolean,
    onGantiOutlet: () -> Unit,
    onBukaProfil: () -> Unit,
    onBukaNotifikasi: () -> Unit = {},
    unreadCount: Int = 0,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = SukaBrown,
        shape = RoundedCornerShape(bottomStart = 22.dp, bottomEnd = 22.dp),
        shadowElevation = 5.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(SukaBrandHeaderGradient)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Baris 1: Logo Brand, Nama Brand & Aksi Kanan (Notif & Avatar)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(SukaOrange),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.LocalFireDepartment,
                                contentDescription = null,
                                tint = SukaInk,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "SUKA SHAWARMA",
                                fontFamily = LilitaOne,
                                fontSize = 15.sp,
                                color = Color(0xFFFFF4EB),
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = "Otentik • Panggang • Gurih",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaOrange,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }

                    // Aksi Kanan: Lonceng Notifikasi & Avatar Profil
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.12f))
                                .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.2f)), CircleShape)
                                .bounceClick(scaleDown = 0.92f) { onBukaNotifikasi() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Notifications,
                                contentDescription = "Notifikasi",
                                tint = Color(0xFFFFF4EB),
                                modifier = Modifier.size(16.dp)
                            )
                            if (unreadCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(top = 5.dp, end = 5.dp)
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(SukaOrange)
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(SukaOrange)
                                .bounceClick(scaleDown = 0.94f) { onBukaProfil() },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "SK",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }
                }

                // Baris 2: Kartu Outlet Ramping & Elegan (Floating Card)
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .bounceClick(scaleDown = 0.98f) { onGantiOutlet() },
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White,
                    shadowElevation = 3.dp,
                    border = BorderStroke(1.dp, SukaBorder)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(CircleShape)
                                    .background(SukaOrange.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.LocationOn,
                                    contentDescription = null,
                                    tint = SukaOrange,
                                    modifier = Modifier.size(16.dp)
                                )
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                                ) {
                                    Text(
                                        text = namaOutlet,
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SukaInk,
                                            fontSize = 13.sp
                                        ),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Box(
                                        modifier = Modifier
                                            .size(4.dp)
                                            .clip(CircleShape)
                                            .background(if (buka) SukaGreen else SukaMuted)
                                    )
                                    Text(
                                        text = if (buka) "Buka" else "Tutup",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (buka) SukaGreen else SukaMuted
                                        )
                                    )
                                }
                                Text(
                                    text = if (buka) "Siap saji dalam 15–20 menit" else "Tidak menerima pesanan",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        fontSize = 10.sp,
                                        color = SukaMuted
                                    )
                                )
                            }
                        }

                        // Tombol Pill "Ganti ▾"
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SukaTint)
                                .border(BorderStroke(1.dp, SukaOrange.copy(alpha = 0.3f)), RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Text(
                                    text = "Ganti",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaBrown,
                                        fontSize = 11.sp
                                    )
                                )
                                Icon(
                                    imageVector = Icons.Filled.KeyboardArrowDown,
                                    contentDescription = "Ganti Outlet",
                                    tint = SukaBrown,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 2. Header Brand untuk Halaman Menu (MenuBrandHeader).
 * Latar SukaBrown melengkung, selector outlet ringkas, serta kolom pencarian terintegrasi.
 */
@Composable
fun MenuBrandHeader(
    namaOutlet: String,
    buka: Boolean,
    kueriPencarian: String,
    onUbahKueri: (String) -> Unit,
    onGantiOutlet: () -> Unit,
    onBukaProfil: () -> Unit,
    modifier: Modifier = Modifier,
    kategoriContent: (@Composable () -> Unit)? = null
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = SukaBrown,
        shape = RoundedCornerShape(bottomStart = 22.dp, bottomEnd = 22.dp),
        shadowElevation = 5.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(SukaBrandHeaderGradient)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(top = 8.dp, bottom = if (kategoriContent != null) 10.dp else 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Baris Atas: Judul Menu, Outlet Pill & Avatar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(SukaOrange),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.LocalFireDepartment,
                                contentDescription = null,
                                tint = SukaInk,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Text(
                                text = "MENU & KATALOG",
                                fontFamily = LilitaOne,
                                fontSize = 15.sp,
                                color = Color(0xFFFFF4EB),
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = "Pilihan Shawarma Otentik",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaOrange,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }

                    // Aksi Kanan: Outlet Selector Chip & Profil
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Pill Outlet
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color.White.copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)),
                            modifier = Modifier
                                .bounceClick(scaleDown = 0.96f) { onGantiOutlet() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Filled.LocationOn,
                                    contentDescription = null,
                                    tint = SukaOrange,
                                    modifier = Modifier.size(13.dp)
                                )
                                Text(
                                    text = namaOutlet,
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Icon(
                                    Icons.Filled.KeyboardArrowDown,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                        }

                        // Avatar
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(SukaOrange)
                                .bounceClick(scaleDown = 0.94f) { onBukaProfil() },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "SK",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }
                }

                // Baris Tengah: Search Box Terintegrasi di Header
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp)
                        .height(42.dp),
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    border = BorderStroke(1.dp, SukaBorder)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Search,
                            contentDescription = "Cari",
                            tint = SukaMuted,
                            modifier = Modifier.size(18.dp)
                        )

                        BasicTextField(
                            value = kueriPencarian,
                            onValueChange = onUbahKueri,
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            textStyle = TextStyle(
                                fontSize = 13.sp,
                                color = SukaInk,
                                fontWeight = FontWeight.Medium
                            ),
                            decorationBox = { innerTextField ->
                                if (kueriPencarian.isEmpty()) {
                                    Text(
                                        text = "Cari menu favorit, shawarma, saus...",
                                        color = SukaMuted,
                                        fontSize = 12.sp
                                    )
                                }
                                innerTextField()
                            }
                        )

                        if (kueriPencarian.isNotEmpty()) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Hapus",
                                tint = SukaMuted,
                                modifier = Modifier
                                    .size(18.dp)
                                    .clickable { onUbahKueri("") }
                            )
                        }
                    }
                }

                // Baris Bawah: Kategori Terintegrasi (Menyatu dalam Header)
                if (kategoriContent != null) {
                    kategoriContent()
                }
            }
        }
    }
}

/**
 * 3. Header Brand Universal untuk Halaman Riwayat Pesanan & Profil (PageBrandHeader).
 * Memberikan konsistensi warna SukaBrown melengkung, tipografi LilitaOne, dan tombol navigasi/aksi.
 */
@Composable
fun PageBrandHeader(
    judul: String,
    subjudul: String? = null,
    onKembali: (() -> Unit)? = null,
    aksiKanan: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = SukaBrown,
        shape = RoundedCornerShape(bottomStart = 22.dp, bottomEnd = 22.dp),
        shadowElevation = 5.dp
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(SukaBrandHeaderGradient)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Sisi Kiri: Tombol Kembali ATAU Logo Api Brand
                if (onKembali != null) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.15f))
                            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)), CircleShape)
                            .bounceClick(onClick = onKembali),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Kembali",
                            tint = Color(0xFFFFF4EB),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(SukaOrange),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.LocalFireDepartment,
                            contentDescription = null,
                            tint = SukaInk,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Sisi Tengah: Judul Halaman & Subjudul
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 8.dp)
                ) {
                    Text(
                        text = judul,
                        fontFamily = LilitaOne,
                        fontSize = 17.sp,
                        color = Color(0xFFFFF4EB),
                        letterSpacing = 0.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (subjudul != null) {
                        Text(
                            text = subjudul,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = SukaOrange,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Sisi Kanan: Aksi Kustom ATAU Spacer Penyeimbang
                if (aksiKanan != null) {
                    aksiKanan()
                } else {
                    Spacer(modifier = Modifier.size(34.dp))
                }
            }
        }
    }
}
