package com.sukashawarma.customer.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange

/**
 * Jam buka outlet. Nilai tetap dari sisi operasional.
 */
private const val JAM_BUKA_OPERASIONAL = "14:00"

/**
 * Layar 16 — Outlet belum melayani pesanan aplikasi.
 */
@Composable
fun OutletClosedScreen(
    namaOutlet: String,
    onGantiOutlet: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(SukaCream)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(26.dp),
            color = Color.White,
            border = BorderStroke(1.dp, SukaBorder),
            shadowElevation = 4.dp
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Clock / Storefront Badge
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFFF4EB)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Schedule,
                        contentDescription = null,
                        tint = SukaOrange,
                        modifier = Modifier.size(36.dp)
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFFFF0E2),
                    border = BorderStroke(1.dp, SukaOrange.copy(alpha = 0.35f))
                ) {
                    Text(
                        text = "BUKA JAM $JAM_BUKA_OPERASIONAL WIB",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Black,
                            color = SukaBrown,
                            fontSize = 10.sp,
                            letterSpacing = 0.5.sp
                        )
                    )
                }

                Text(
                    text = "Outlet Belum Buka",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontFamily = LilitaOne,
                        color = SukaBrown,
                        fontSize = 22.sp
                    ),
                    textAlign = TextAlign.Center
                )

                Text(
                    text = "$namaOutlet belum melayani pesanan aplikasi saat ini. Keranjangmu tetap kami simpan dengan aman.",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = SukaMuted,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    ),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(4.dp))

                Button(
                    onClick = onGantiOutlet,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .bounceClick(),
                    shape = RoundedCornerShape(25.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SukaOrange,
                        contentColor = SukaBrown
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
                ) {
                    Text(
                        text = "Pilih Outlet Lain",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaBrown,
                            fontSize = 14.sp
                        )
                    )
                }

                OutlinedButton(
                    onClick = {},
                    enabled = false,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = RoundedCornerShape(23.dp),
                    border = BorderStroke(1.dp, Color(0xFFE5E7EB))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Notifications,
                            contentDescription = null,
                            tint = SukaMuted,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "Ingatkan Saya Saat Buka",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = SukaMuted,
                                fontSize = 12.sp
                            )
                        )
                    }
                }

                Text(
                    text = "Fitur pengingat notifikasi akan hadir di pembaruan berikutnya.",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = SukaMuted.copy(alpha = 0.8f),
                        fontSize = 10.sp
                    ),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
