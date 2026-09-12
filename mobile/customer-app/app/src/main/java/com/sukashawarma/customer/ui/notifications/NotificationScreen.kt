package com.sukashawarma.customer.ui.notifications

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.NotificationDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.PageBrandHeader
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

@Composable
fun NotificationScreen(
    viewModel: NotificationViewModel,
    onBukaStatusPesanan: (String) -> Unit,
    onBukaMenu: () -> Unit,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Notifikasi",
                subjudul = if (state.unreadCount > 0) "${state.unreadCount} belum dibaca" else "Kotak Masuk & Promo",
                onKembali = onKembali
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            // Baris Tab Filter & Tombol Tandai Semua Dibaca
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Filter Category Chips
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    KategoriNotifikasi.values().forEach { tab ->
                        val aktif = state.tabTerpilih == tab
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (aktif) SukaOrange else Color.White,
                            border = BorderStroke(1.dp, if (aktif) SukaOrange else SukaBorder),
                            modifier = Modifier.bounceClick(scaleDown = 0.95f) {
                                viewModel.gantiTab(tab)
                            }
                        ) {
                            Text(
                                text = tab.label,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = if (aktif) FontWeight.Bold else FontWeight.Medium,
                                    color = if (aktif) SukaInk else SukaMuted,
                                    fontSize = 12.sp
                                ),
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                // Tombol Tandai Semua Dibaca
                if (state.unreadCount > 0) {
                    TextButton(
                        onClick = viewModel::tandaiSemuaDibaca,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.DoneAll,
                                contentDescription = null,
                                tint = SukaOrange,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "Baca Semua",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaOrange,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }
                }
            }

            // Konten Notifikasi
            when {
                state.memuat -> MemuatState()

                state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::muat
                )

                state.notifikasiTampil.isEmpty() -> {
                    EmptyState(
                        judul = when (state.tabTerpilih) {
                            KategoriNotifikasi.SEMUA -> "Belum Ada Notifikasi"
                            KategoriNotifikasi.PESANAN -> "Tidak Ada Info Pesanan"
                            KategoriNotifikasi.PROMO -> "Belum Ada Promo Aktif"
                        },
                        penjelasan = when (state.tabTerpilih) {
                            KategoriNotifikasi.SEMUA -> "Semua pembaruan status pesanan dan promosi spesial akan masuk ke sini."
                            KategoriNotifikasi.PESANAN -> "Notifikasi proses pembuatan dan siap ambil akan tampil saat kamu memesan."
                            KategoriNotifikasi.PROMO -> "Nantikan voucher diskon dan penawaran menarik berikutnya!"
                        }
                    )
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(state.notifikasiTampil, key = { it.id }) { notif ->
                            NotificationCard(
                                notif = notif,
                                onKlik = {
                                    viewModel.tandaiDibaca(notif.id)
                                    if (notif.orderId != null) {
                                        onBukaStatusPesanan(notif.orderId)
                                    } else if (notif.type == "promo") {
                                        onBukaMenu()
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationCard(
    notif: NotificationDto,
    onKlik: () -> Unit
) {
    val unread = !notif.isRead
    val iconColor = when (notif.type) {
        "order_status" -> if (notif.title.contains("Siap", ignoreCase = true)) SukaGreen else SukaOrange
        "reminder" -> Color(0xFFE11D48)
        "promo" -> Color(0xFFD97706)
        else -> SukaOrange
    }
    val iconVector: ImageVector = when (notif.type) {
        "order_status" -> if (notif.title.contains("Siap", ignoreCase = true)) Icons.Filled.CheckCircle else Icons.Filled.Restaurant
        "reminder" -> Icons.Filled.Alarm
        "promo" -> Icons.Filled.LocalOffer
        else -> Icons.Filled.Notifications
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .bounceClick(scaleDown = 0.98f) { onKlik() },
        shape = RoundedCornerShape(16.dp),
        color = if (unread) Color(0xFFFFF9F2) else Color.White,
        border = BorderStroke(
            1.dp,
            if (unread) SukaOrange.copy(alpha = 0.4f) else SukaBorder
        ),
        shadowElevation = if (unread) 2.dp else 0.dp
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Icon Badge
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = iconVector,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Info Body
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notif.title,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 14.sp
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )

                    // Dot indikator unread
                    if (unread) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(SukaOrange)
                        )
                    }
                }

                Text(
                    text = notif.body,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = SukaInk.copy(alpha = 0.85f),
                        fontSize = 12.sp,
                        lineHeight = 17.sp
                    )
                )

                // Footer: tombol aksi kontekstual
                if (notif.orderId != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Lihat detail pesanan →",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = SukaOrange,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    )
                } else if (notif.type == "promo") {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Buka katalog menu →",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = SukaOrange,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    )
                }
            }
        }
    }
}
