package com.sukashawarma.superapp.ui.features.settings

import android.app.TimePickerDialog
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.superapp.data.Outlet
import com.sukashawarma.superapp.data.OutletAttendanceConfigDto
import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.data.SupabaseClient
import kotlinx.coroutines.launch
import java.util.*

private object SettingsTheme {
    val Primary = Color(0xFF047857)
    val PrimaryLight = Color(0xFF10B981)
    val PrimaryContainer = Color(0xFFD1FAE5)
    val SurfaceBackground = Color(0xFFFFF8F1)
    val TextMain = Color(0xFF1E293B)
    val TextMuted = Color(0xFF64748B)
    val CardBg = Color.White
    val CardBorder = Color(0xFFE2E8F0)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceSettingsScreen(
    currentStaff: Staff?,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var outlets by remember { mutableStateOf<List<Outlet>>(emptyList()) }
    var selectedOutlet by remember { mutableStateOf<Outlet?>(null) }
    var showOutletDropdown by remember { mutableStateOf(false) }

    var jamMasuk by remember { mutableStateOf("09:00") }
    var jamKeluar by remember { mutableStateOf("17:00") }
    var toleransiMenit by remember { mutableStateOf(15) }
    var windowMode by remember { mutableStateOf("auto") } // "auto" or "manual"
    var radiusM by remember { mutableStateOf(100) }

    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }

    // Load outlets & config
    LaunchedEffect(Unit) {
        isLoading = true
        try {
            val allOutlets = SupabaseClient.getInstance().getAllOutlets()
            outlets = allOutlets
            val initialOutlet = if (currentStaff?.outletId != null) {
                allOutlets.firstOrNull { it.id == currentStaff.outletId } ?: allOutlets.firstOrNull()
            } else {
                allOutlets.firstOrNull()
            }
            selectedOutlet = initialOutlet

            if (initialOutlet != null) {
                val cfg = SupabaseClient.getInstance().getConfig(initialOutlet.id)
                if (cfg != null) {
                    jamMasuk = cfg.jamMasuk.take(5)
                    jamKeluar = cfg.jamKeluar.take(5)
                    toleransiMenit = cfg.toleransiMenit
                    windowMode = cfg.absenWindowMode
                    radiusM = cfg.radiusM ?: 100
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    // Load config when outlet selection changes
    fun onSelectOutlet(outlet: Outlet) {
        selectedOutlet = outlet
        showOutletDropdown = false
        scope.launch {
            isLoading = true
            try {
                val cfg = SupabaseClient.getInstance().getConfig(outlet.id)
                if (cfg != null) {
                    jamMasuk = cfg.jamMasuk.take(5)
                    jamKeluar = cfg.jamKeluar.take(5)
                    toleransiMenit = cfg.toleransiMenit
                    windowMode = cfg.absenWindowMode
                    radiusM = cfg.radiusM ?: 100
                } else {
                    jamMasuk = "09:00"
                    jamKeluar = "17:00"
                    toleransiMenit = 15
                    windowMode = "auto"
                    radiusM = 100
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Pengaturan Absensi",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Text(
                            "Konfigurasi Shift & Kebijakan Outlet",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Kembali",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SettingsTheme.Primary
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(SettingsTheme.SurfaceBackground)
        ) {
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SettingsTheme.Primary)
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp)
                ) {
                    // 1. Outlet Selector Card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = SettingsTheme.CardBg,
                        border = androidx.compose.foundation.BorderStroke(1.dp, SettingsTheme.CardBorder),
                        shadowElevation = 2.dp
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .background(SettingsTheme.PrimaryContainer, CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Default.Storefront,
                                            contentDescription = null,
                                            tint = SettingsTheme.Primary,
                                            modifier = Modifier.size(20.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            "Target Outlet",
                                            style = MaterialTheme.typography.labelMedium.copy(
                                                color = SettingsTheme.TextMuted,
                                                fontWeight = FontWeight.Medium
                                            )
                                        )
                                        Text(
                                            selectedOutlet?.name ?: "Pilih Outlet",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = SettingsTheme.TextMain
                                            )
                                        )
                                    }
                                }

                                if (outlets.size > 1) {
                                    FilledTonalButton(
                                        onClick = { showOutletDropdown = !showOutletDropdown },
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        colors = ButtonDefaults.filledTonalButtonColors(
                                            containerColor = SettingsTheme.PrimaryContainer,
                                            contentColor = SettingsTheme.Primary
                                        )
                                    ) {
                                        Text("Ganti", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Icon(Icons.Default.ArrowDropDown, null, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }

                            if (showOutletDropdown) {
                                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = SettingsTheme.CardBorder)
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    outlets.forEach { o ->
                                        val isSelected = o.id == selectedOutlet?.id
                                        Surface(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable { onSelectOutlet(o) },
                                            shape = RoundedCornerShape(8.dp),
                                            color = if (isSelected) SettingsTheme.PrimaryContainer.copy(alpha = 0.5f) else Color.Transparent
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween
                                            ) {
                                                Text(
                                                    o.name,
                                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                                    color = if (isSelected) SettingsTheme.Primary else SettingsTheme.TextMain,
                                                    fontSize = 14.sp
                                                )
                                                if (isSelected) {
                                                    Icon(Icons.Default.Check, null, tint = SettingsTheme.Primary, modifier = Modifier.size(16.dp))
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2. Shift Working Hours
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = SettingsTheme.CardBg,
                        border = androidx.compose.foundation.BorderStroke(1.dp, SettingsTheme.CardBorder),
                        shadowElevation = 2.dp
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.AccessTime, null, tint = SettingsTheme.Primary, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Jam Operasional Shift",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = SettingsTheme.TextMain
                                    )
                                )
                            }
                            Spacer(modifier = Modifier.height(14.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                // Jam Masuk Card
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            val parts = jamMasuk.split(":")
                                            val h = parts.getOrNull(0)?.toIntOrNull() ?: 9
                                            val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
                                            TimePickerDialog(context, { _, hour, min ->
                                                jamMasuk = String.format(Locale.US, "%02d:%02d", hour, min)
                                            }, h, m, true).show()
                                        },
                                    shape = RoundedCornerShape(12.dp),
                                    color = SettingsTheme.SurfaceBackground,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2D9CE))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(14.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("JAM MASUK", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SettingsTheme.TextMuted)
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            jamMasuk,
                                            fontSize = 24.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SettingsTheme.Primary
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Edit, null, tint = SettingsTheme.TextMuted, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Ubah", fontSize = 11.sp, color = SettingsTheme.TextMuted)
                                        }
                                    }
                                }

                                // Jam Keluar Card
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            val parts = jamKeluar.split(":")
                                            val h = parts.getOrNull(0)?.toIntOrNull() ?: 17
                                            val m = parts.getOrNull(1)?.toIntOrNull() ?: 0
                                            TimePickerDialog(context, { _, hour, min ->
                                                jamKeluar = String.format(Locale.US, "%02d:%02d", hour, min)
                                            }, h, m, true).show()
                                        },
                                    shape = RoundedCornerShape(12.dp),
                                    color = SettingsTheme.SurfaceBackground,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2D9CE))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(14.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("JAM KELUAR", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SettingsTheme.TextMuted)
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(
                                            jamKeluar,
                                            fontSize = 24.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFF904D00)
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Edit, null, tint = SettingsTheme.TextMuted, modifier = Modifier.size(12.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Ubah", fontSize = 11.sp, color = SettingsTheme.TextMuted)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 3. Late Tolerance Settings
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = SettingsTheme.CardBg,
                        border = androidx.compose.foundation.BorderStroke(1.dp, SettingsTheme.CardBorder),
                        shadowElevation = 2.dp
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.HourglassTop, null, tint = SettingsTheme.Primary, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Toleransi Keterlambatan",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = SettingsTheme.TextMain
                                    )
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                "Durasi menit toleransi sebelum kru dinyatakan 'Telat'.",
                                style = MaterialTheme.typography.bodySmall.copy(color = SettingsTheme.TextMuted)
                            )
                            Spacer(modifier = Modifier.height(14.dp))

                            // Preset Pills
                            val presets = listOf(0, 5, 10, 15, 30)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                presets.forEach { p ->
                                    val isSelected = toleransiMenit == p
                                    Surface(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable { toleransiMenit = p },
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (isSelected) SettingsTheme.Primary else SettingsTheme.SurfaceBackground,
                                        border = androidx.compose.foundation.BorderStroke(
                                            1.dp,
                                            if (isSelected) SettingsTheme.Primary else Color(0xFFE2D9CE)
                                        )
                                    ) {
                                        Text(
                                            "$p mnt",
                                            modifier = Modifier.padding(vertical = 10.dp),
                                            textAlign = TextAlign.Center,
                                            fontSize = 13.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (isSelected) Color.White else SettingsTheme.TextMain
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = SettingsTheme.PrimaryContainer.copy(alpha = 0.4f),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Info, null, tint = SettingsTheme.Primary, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        "Kru absen $jamMasuk - ${calculateToleranceLimit(jamMasuk, toleransiMenit)} WIB dihitung On-Time.",
                                        fontSize = 12.sp,
                                        color = SettingsTheme.Primary,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }

                    // 4. Window Mode & Radius
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = SettingsTheme.CardBg,
                        border = androidx.compose.foundation.BorderStroke(1.dp, SettingsTheme.CardBorder),
                        shadowElevation = 2.dp
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Tune, null, tint = SettingsTheme.Primary, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Mode Jendela & Geofence",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = SettingsTheme.TextMain
                                    )
                                )
                            }
                            Spacer(modifier = Modifier.height(14.dp))

                            // Segmented Mode Switch
                            Text("MODE JENDELA ABSENSI", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SettingsTheme.TextMuted)
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SettingsTheme.SurfaceBackground, RoundedCornerShape(12.dp))
                                    .padding(4.dp),
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                val isAuto = windowMode == "auto"
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { windowMode = "auto" },
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (isAuto) SettingsTheme.Primary else Color.Transparent
                                ) {
                                    Text(
                                        "Otomatis (Jadwal)",
                                        modifier = Modifier.padding(vertical = 8.dp),
                                        textAlign = TextAlign.Center,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isAuto) Color.White else SettingsTheme.TextMuted
                                    )
                                }
                                Surface(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable { windowMode = "manual" },
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (!isAuto) SettingsTheme.Primary else Color.Transparent
                                ) {
                                    Text(
                                        "Manual (SPV Toggle)",
                                        modifier = Modifier.padding(vertical = 8.dp),
                                        textAlign = TextAlign.Center,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (!isAuto) Color.White else SettingsTheme.TextMuted
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Geofence Radius
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("RADIUS GEOFENCE GPS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SettingsTheme.TextMuted)
                                Surface(
                                    color = SettingsTheme.PrimaryContainer,
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        "$radiusM meter",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SettingsTheme.Primary
                                    )
                                }
                            }
                            Slider(
                                value = radiusM.toFloat(),
                                onValueChange = { radiusM = it.toInt() },
                                valueRange = 25f..300f,
                                steps = 10,
                                colors = SliderDefaults.colors(
                                    thumbColor = SettingsTheme.Primary,
                                    activeTrackColor = SettingsTheme.Primary
                                )
                            )
                            Text(
                                "Jarak maksimal kru dari titik koordinat GPS outlet saat absensi.",
                                fontSize = 11.sp,
                                color = SettingsTheme.TextMuted
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Save Button
                    Button(
                        onClick = {
                            val targetOutletId = selectedOutlet?.id
                            if (targetOutletId == null) {
                                scope.launch { snackbarHostState.showSnackbar("Outlet belum dipilih!") }
                                return@Button
                            }
                            isSaving = true
                            scope.launch {
                                try {
                                    val newConfig = OutletAttendanceConfigDto(
                                        outletId = targetOutletId,
                                        jamMasuk = "$jamMasuk:00",
                                        jamKeluar = "$jamKeluar:00",
                                        toleransiMenit = toleransiMenit,
                                        absenWindowMode = windowMode,
                                        radiusM = radiusM
                                    )
                                    val success = SupabaseClient.getInstance().updateAttendanceConfig(newConfig)
                                    if (success) {
                                        snackbarHostState.showSnackbar("Pengaturan absensi berhasil disimpan!")
                                    } else {
                                        snackbarHostState.showSnackbar("Gagal menyimpan ke server.")
                                    }
                                } catch (e: Exception) {
                                    snackbarHostState.showSnackbar("Error: ${e.message}")
                                } finally {
                                    isSaving = false
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SettingsTheme.Primary),
                        enabled = !isSaving
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Save, null, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Simpan Pengaturan", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(30.dp))
                }
            }
        }
    }
}

private fun calculateToleranceLimit(jamMasuk: String, toleransi: Int): String {
    return try {
        val parts = jamMasuk.split(":")
        val h = parts[0].toInt()
        val m = parts[1].toInt()
        val totalMin = h * 60 + m + toleransi
        val newH = (totalMin / 60) % 24
        val newM = totalMin % 60
        String.format(Locale.US, "%02d:%02d", newH, newM)
    } catch (_: Exception) {
        jamMasuk
    }
}
