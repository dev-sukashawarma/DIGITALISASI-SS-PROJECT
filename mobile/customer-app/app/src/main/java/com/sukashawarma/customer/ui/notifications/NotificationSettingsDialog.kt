package com.sukashawarma.customer.ui.notifications

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Percent
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
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
fun NotificationSettingsDialog(
    statusPesananAwal: Boolean,
    promoAwal: Boolean,
    onSimpan: (statusPesanan: Boolean, promo: Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    var statusPesanan by remember { mutableStateOf(statusPesananAwal) }
    var promo by remember { mutableStateOf(promoAwal) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color.White,
            border = BorderStroke(1.dp, SukaBorder),
            shadowElevation = 8.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header Dialog
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Pengaturan Notifikasi",
                            fontFamily = LilitaOne,
                            fontSize = 18.sp,
                            color = SukaBrown
                        )
                        Text(
                            text = "Kelola notifikasi yang ingin kamu terima",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = SukaMuted,
                                fontSize = 11.sp
                            )
                        )
                    }

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Tutup",
                            tint = SukaMuted
                        )
                    }
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF3ECE4)))

                // Item 1: Status Pesanan
                NotificationSettingItem(
                    icon = Icons.Filled.NotificationsActive,
                    iconTint = SukaOrange,
                    judul = "Status Pesanan & Pengambilan",
                    subjudul = "Pemberitahuan saat pesanan sedang dibuat, siap diambil di kasir, dan pengingat.",
                    checked = statusPesanan,
                    onCheckedChange = { statusPesanan = it }
                )

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0xFFF3ECE4)))

                // Item 2: Promo & Pemasaran
                NotificationSettingItem(
                    icon = Icons.Filled.Percent,
                    iconTint = SukaGreen,
                    judul = "Promo & Penawaran Spesial",
                    subjudul = "Diskon eksklusif, voucher reward, dan informasi menu musiman.",
                    checked = promo,
                    onCheckedChange = { promo = it }
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Tombol Simpan
                Button(
                    onClick = {
                        onSimpan(statusPesanan, promo)
                        onDismiss()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .bounceClick(scaleDown = 0.98f) {},
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SukaOrange)
                ) {
                    Text(
                        text = "Simpan Perubahan",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 14.sp
                        ),
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun NotificationSettingItem(
    icon: ImageVector,
    iconTint: Color,
    judul: String,
    subjudul: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = iconTint.copy(alpha = 0.12f),
            modifier = Modifier.size(38.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = judul,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = SukaInk,
                    fontSize = 13.sp
                )
            )
            Text(
                text = subjudul,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = SukaMuted,
                    fontSize = 11.sp,
                    lineHeight = 15.sp
                )
            )
        }

        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = SukaOrange,
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = SukaBorder
            )
        )
    }
}
