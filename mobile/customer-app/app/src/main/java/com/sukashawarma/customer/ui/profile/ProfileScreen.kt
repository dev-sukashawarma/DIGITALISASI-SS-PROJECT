package com.sukashawarma.customer.ui.profile

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.sukashawarma.customer.ui.notifications.NotificationSettingsDialog
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.data.SessionData
import com.sukashawarma.customer.ui.components.BottomNavTab
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.components.SukaBottomNavBar
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
 * Layar 15 - Profil & Pengaturan Akun ala Stitch Design System.
 */
@Composable
fun ProfileScreen(
    sesi: SessionData?,
    onKeluar: () -> Unit,
    onLihatRiwayat: () -> Unit,
    onKembali: () -> Unit,
    statusPesananAktif: Boolean = true,
    promoAktif: Boolean = true,
    onSimpanPreferensiNotifikasi: (statusPesanan: Boolean, promo: Boolean) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    var tampilkanDialogNotifikasi by remember { mutableStateOf(false) }

    if (tampilkanDialogNotifikasi) {
        NotificationSettingsDialog(
            statusPesananAwal = statusPesananAktif,
            promoAwal = promoAktif,
            onSimpan = onSimpanPreferensiNotifikasi,
            onDismiss = { tampilkanDialogNotifikasi = false }
        )
    }

    val inisial = remember(sesi?.nama) {
        sesi?.nama?.split(" ")?.take(2)?.mapNotNull { it.firstOrNull() }?.joinToString("")?.uppercase()
            ?: "SS"
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Akun Saya",
                subjudul = "Profil & Pengaturan Akun",
                onKembali = onKembali
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. Profile Header Card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder),
                shadowElevation = 3.dp
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Deep Brown Avatar
                        Box(
                            modifier = Modifier
                                .size(60.dp)
                                .clip(CircleShape)
                                .background(SukaBrown),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = inisial,
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontFamily = LilitaOne,
                                    color = Color.White,
                                    fontSize = 22.sp
                                )
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = sesi?.nama ?: "Pelanggan Suka",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 16.sp
                                )
                            )
                            Text(
                                text = sesi?.email ?: "Belum ada email",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = SukaMuted,
                                    fontSize = 12.sp
                                )
                            )

                            Surface(
                                modifier = Modifier.padding(top = 4.dp),
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFECFDF5)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Verified,
                                        contentDescription = null,
                                        tint = SukaGreen,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Text(
                                        text = "Pelanggan Setia",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaGreen,
                                            fontSize = 10.sp
                                        )
                                    )
                                }
                            }
                        }
                    }

                    // Phone / WhatsApp Status
                    if (!sesi?.telepon.isNullOrBlank()) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFDCFCE7).copy(alpha = 0.6f),
                            border = BorderStroke(1.dp, Color(0xFF86EFAC))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Phone,
                                        contentDescription = null,
                                        tint = SukaGreen,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = sesi!!.telepon!!,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF15803D),
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                                Text(
                                    text = "TERVERIFIKASI",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Black,
                                        color = SukaGreen,
                                        fontSize = 9.sp
                                    )
                                )
                            }
                        }
                    } else {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            color = SukaTint,
                            border = BorderStroke(1.dp, SukaBorder)
                        ) {
                            Text(
                                text = "Nomor HP belum ditambahkan. Tidak wajib untuk memesan; nanti diperlukan saat program referral dibuka.",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = SukaInk,
                                    fontSize = 11.sp,
                                    lineHeight = 15.sp
                                ),
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    // Quick Stats Row
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(Color(0xFFF5EADB))
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "12",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontFamily = LilitaOne,
                                    color = SukaBrown,
                                    fontSize = 18.sp
                                )
                            )
                            Text(
                                text = "Pesanan Selesai",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 10.sp
                                )
                            )
                        }

                        Box(
                            modifier = Modifier
                                .width(1.dp)
                                .height(30.dp)
                                .background(Color(0xFFF5EADB))
                        )

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Bogor Pajajaran",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = SukaInk,
                                    fontSize = 13.sp
                                )
                            )
                            Text(
                                text = "Outlet Favorit",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 10.sp
                                )
                            )
                        }
                    }
                }
            }

            // 2. Pengaturan Akun
            Text(
                text = "PENGATURAN AKUN",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Black,
                    color = SukaMuted,
                    fontSize = 10.sp,
                    letterSpacing = 0.5.sp
                ),
                modifier = Modifier.padding(horizontal = 4.dp)
            )

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder)
            ) {
                Column {
                    ProfileMenuItem(
                        icon = Icons.Filled.ReceiptLong,
                        title = "Riwayat Pesanan",
                        subtitle = "Pantau status & pesanan sebelumnya",
                        onClick = onLihatRiwayat
                    )
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF8EFE7)))
                    ProfileMenuItem(
                        icon = Icons.Filled.Person,
                        title = "Informasi Akun",
                        subtitle = sesi?.email ?: "Akun Pelanggan",
                        onClick = {}
                    )
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF8EFE7)))
                    ProfileMenuItem(
                        icon = Icons.Filled.Notifications,
                        title = "Pengaturan Notifikasi",
                        subtitle = "Preferensi status pesanan & promo",
                        onClick = { tampilkanDialogNotifikasi = true }
                    )
                }
            }

            // 3. Bantuan & Informasi
            Text(
                text = "BANTUAN & INFORMASI",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Black,
                    color = SukaMuted,
                    fontSize = 10.sp,
                    letterSpacing = 0.5.sp
                ),
                modifier = Modifier.padding(horizontal = 4.dp)
            )

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder)
            ) {
                Column {
                    ProfileMenuItem(
                        icon = Icons.Filled.HelpOutline,
                        title = "Pusat Bantuan & FAQ",
                        subtitle = "Pertanyaan seputar order & ambil pesanan",
                        onClick = {}
                    )
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF8EFE7)))
                    ProfileMenuItem(
                        icon = Icons.Filled.SupportAgent,
                        title = "Hubungi Customer Care",
                        subtitle = "WhatsApp Care: 09.00 – 22.00 WIB",
                        onClick = {}
                    )
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF8EFE7)))
                    ProfileMenuItem(
                        icon = Icons.Filled.Security,
                        title = "Kebijakan Privasi",
                        subtitle = "Keamanan data pelanggan Suka Shawarma",
                        onClick = {}
                    )
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF8EFE7)))
                    ProfileMenuItem(
                        icon = Icons.Filled.Description,
                        title = "Syarat & Ketentuan Layanan",
                        subtitle = "Ketentuan pemesanan & pengambilan",
                        onClick = {}
                    )
                }
            }

            // 4. Logout Button
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .bounceClick(scaleDown = 0.98f) { onKeluar() },
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFFCA5A5))
            ) {
                Row(
                    modifier = Modifier.padding(vertical = 14.dp, horizontal = 16.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null,
                        tint = Color(0xFFDC2626),
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Keluar dari Akun",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFDC2626),
                            fontSize = 14.sp
                        )
                    )
                }
            }

            // Version Footer
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Suka Shawarma Mobile v1.0.0",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = SukaMuted,
                        fontSize = 11.sp
                    )
                )
                Text(
                    text = "Rasa Autentik Cepat Saji",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = SukaMuted.copy(alpha = 0.7f),
                        fontSize = 10.sp
                    )
                )
            }
        }
    }
}

@Composable
private fun ProfileMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 13.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(Color(0xFFFFF4EB)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = SukaOrange,
                modifier = Modifier.size(18.dp)
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = SukaInk,
                    fontSize = 13.sp
                )
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = SukaMuted,
                    fontSize = 11.sp
                )
            )
        }

        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = SukaMuted,
            modifier = Modifier.size(18.dp)
        )
    }
}
