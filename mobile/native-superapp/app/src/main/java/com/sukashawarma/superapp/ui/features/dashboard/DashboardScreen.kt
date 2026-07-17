package com.sukashawarma.superapp.ui.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.superapp.data.Staff
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

object PortalTheme {
    val Primary = Color(0xFF9D4300)
    val PrimaryContainer = Color(0xFFF97316).copy(alpha = 0.3f)
    val Secondary = Color(0xFF944A00)
    val SecondaryContainer = Color(0xFFFD933D).copy(alpha = 0.2f)
    val Tertiary = Color(0xFF006686)
    val TertiaryContainer = Color(0xFF4AA4CB).copy(alpha = 0.2f)
    val BackgroundGradient = Brush.verticalGradient(
        colors = listOf(Color(0xFFFFF8F1), Color(0xFFF5EDE3))
    )
    val OnSurface = Color(0xFF1E1B15)
    val OnSurfaceVariant = Color(0xFF584237)
    val GlassWhite = Color.White.copy(alpha = 0.4f)
    val GlassBorder = Color.White.copy(alpha = 0.6f)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(staff: Staff?, onAppClick: (String) -> Unit = {}) {
    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = {
            scope.launch {
                isRefreshing = true
                delay(1500)
                isRefreshing = false
            }
        },
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(PortalTheme.BackgroundGradient)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            ClockCard(staff)
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "Aplikasi",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Medium,
                    color = PortalTheme.OnSurface
                ),
                modifier = Modifier.padding(start = 4.dp, bottom = 16.dp)
            )
            
            val appMeta = mapOf(
                "Enrollment" to PortalApp("Enrollment", Icons.Default.Face, PortalTheme.Tertiary, PortalTheme.TertiaryContainer),
                "Absensi" to PortalApp("Absensi", Icons.Default.Fingerprint, PortalTheme.Primary, PortalTheme.PrimaryContainer),
                "Kalibrasi Wajah" to PortalApp("Kalibrasi Wajah", Icons.Default.Tune, PortalTheme.Secondary, PortalTheme.SecondaryContainer)
            )
            // Fase 1: hanya fitur fungsional. Tile Stok/Distribusi/POS/Kiosk/Dashboard menyusul
            // saat modulnya nyata (fase 3) — jangan tampilkan tombol mati.
            val apps = DashboardMenu.menuFor(staff?.role).mapNotNull { appMeta[it] }

            apps.chunked(2).forEach { rowApps ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    rowApps.forEach { app ->
                        PortalAppCard(app, Modifier.weight(1f)) {
                            onAppClick(app.name)
                        }
                    }
                    if (rowApps.size == 1) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            Spacer(modifier = Modifier.height(100.dp))
        }
    }
}

@Composable
fun ClockCard(staff: Staff?) {
    val time = SimpleDateFormat("HH:mm", Locale.forLanguageTag("id-ID")).format(Date())
    val date = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.forLanguageTag("id-ID")).format(Date())

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp)),
        color = PortalTheme.GlassWhite,
        border = androidx.compose.foundation.BorderStroke(1.dp, PortalTheme.GlassBorder)
    ) {
        Column(
            modifier = Modifier.padding(vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    tint = PortalTheme.Primary,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = time,
                    style = MaterialTheme.typography.displayMedium.copy(
                        color = PortalTheme.Primary,
                        fontWeight = FontWeight.Normal,
                        letterSpacing = (-1).sp
                    )
                )
            }
            Text(
                text = date.uppercase(),
                style = MaterialTheme.typography.labelMedium.copy(
                    color = PortalTheme.OnSurfaceVariant,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp
                )
            )
            
            if (staff != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.padding(horizontal = 24.dp).fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = PortalTheme.PrimaryContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Text(
                            text = staff.role.uppercase(),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = PortalTheme.Primary
                            ),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                    
                    Surface(
                        color = PortalTheme.TertiaryContainer,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = PortalTheme.Tertiary, modifier = Modifier.size(12.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = staff.assignedOutletId,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = PortalTheme.Tertiary
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PortalAppCard(app: PortalApp, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
    Surface(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(16.dp))
            .clickable { onClick() },
        color = PortalTheme.GlassWhite,
        border = androidx.compose.foundation.BorderStroke(1.dp, PortalTheme.GlassBorder)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(app.containerColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = app.icon,
                    contentDescription = app.name,
                    tint = app.color,
                    modifier = Modifier.size(30.dp)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = app.name,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontWeight = FontWeight.Medium,
                    color = PortalTheme.OnSurface
                )
            )
        }
    }
}

data class PortalApp(val name: String, val icon: ImageVector, val color: Color, val containerColor: Color)