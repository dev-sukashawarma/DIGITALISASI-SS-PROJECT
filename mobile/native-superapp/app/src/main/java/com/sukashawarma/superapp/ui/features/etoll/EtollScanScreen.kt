package com.sukashawarma.superapp.ui.features.etoll

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.ui.features.dashboard.PortalTheme
import com.sukashawarma.superapp.utils.LocationHelper
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private val QUICK_CATEGORIES = listOf(
    "tol" to "Tol",
    "parkir" to "Parkir",
    "bbm_merchant" to "BBM/Merchant",
    "operasional_lain" to "Operasional",
    "pribadi_anomali" to "Pribadi"
)

private enum class EtollScanMode {
    AUDIT_PERUSAHAAN,
    CEK_SALDO_BIASA
}

@Composable
fun EtollScanScreen(
    currentStaff: Staff?,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    val repo = remember { EtollRepository() }
    val locationHelper = remember { LocationHelper(context) }
    val nfcAdapter = remember { NfcAdapter.getDefaultAdapter(context) }

    var scanMode by remember { mutableStateOf(EtollScanMode.AUDIT_PERUSAHAAN) }
    var isScanningSync by remember { mutableStateOf(false) }
    var lastNfcRead by remember { mutableStateOf<NfcReadCardResult?>(null) }
    var scanResponse by remember { mutableStateOf<EtollScanResponse?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var infoMessage by remember { mutableStateOf<String?>(null) }
    val currentScanMode by rememberUpdatedState(scanMode)

    // Inline quick-register state (khusus Finance/Admin saat tap kartu baru)
    var regLabel by remember { mutableStateOf("") }
    var regDivision by remember { mutableStateOf("Distribusi") }
    var regPlate by remember { mutableStateOf("") }
    var isRegistering by remember { mutableStateOf(false) }

    // Per-transaction tagging state
    val taggedIds = remember { mutableStateMapOf<String, Boolean>() }
    val selectedCategoryMap = remember { mutableStateMapOf<String, String>() }
    val noteMap = remember { mutableStateMapOf<String, String>() }

    suspend fun syncReadCard(read: NfcReadCardResult) {
        isScanningSync = true
        errorMessage = null
        infoMessage = null
        try {
            val hasLocPerm = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED

            val loc = if (hasLocPerm) locationHelper.getCurrentLocation() else null
            val isoNow = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'+07:00'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("Asia/Jakarta")
            }.format(Date())

            val req = EtollScanRequest(
                cardNumber = read.cardNumber,
                issuer = read.issuer,
                balance = read.balance,
                scannedAt = isoNow,
                gpsLat = loc?.latitude,
                gpsLng = loc?.longitude,
                deviceInfo = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})",
                transactions = read.transactions,
                rawDiagnostics = read.rawDiagnostics
            )
            val res = repo.submitScan(req)
            scanResponse = res
            if (!res.ok) {
                errorMessage = res.error ?: "Gagal menyinkronkan kartu"
            } else {
                infoMessage = "Data kartu berhasil tersinkron ke Dashboard Finance!"
                res.newTransactions.forEach { tx ->
                    if (!selectedCategoryMap.containsKey(tx.id)) {
                        selectedCategoryMap[tx.id] =
                            if (tx.category == "belum_dikategorikan") "tol" else tx.category
                    }
                }
            }
        } catch (e: Exception) {
            errorMessage = e.message ?: "Gagal mengirim data scan ke server"
        } finally {
            isScanningSync = false
        }
    }

    // Aktifkan NFC ReaderMode saat layar terbuka
    DisposableEffect(activity, nfcAdapter) {
        val enabled = nfcAdapter != null && nfcAdapter.isEnabled && activity != null
        if (enabled) {
            val flags = NfcAdapter.FLAG_READER_NFC_A or
                NfcAdapter.FLAG_READER_NFC_B or
                NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK

            nfcAdapter!!.enableReaderMode(
                activity!!,
                { tag ->
                    if (isScanningSync) return@enableReaderMode
                    val result = EtollNfcReader.readTag(tag)
                    scope.launch {
                        result.onSuccess { read ->
                            lastNfcRead = read
                            if (currentScanMode == EtollScanMode.CEK_SALDO_BIASA) {
                                scanResponse = null
                                errorMessage = null
                                infoMessage = "Saldo berhasil dibaca (Mode Cek Saldo Biasa — tidak disimpan ke Dashboard Finance)."
                            } else {
                                syncReadCard(read)
                            }
                        }.onFailure { err ->
                            errorMessage = err.message ?: "Gagal membaca kartu NFC"
                        }
                    }
                },
                flags,
                null
            )
        }
        onDispose {
            if (enabled) {
                runCatching { nfcAdapter?.disableReaderMode(activity) }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PortalTheme.BackgroundGradient)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 14.dp)
    ) {
        // Header bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = PortalTheme.Primary)
            }
            Spacer(modifier = Modifier.width(4.dp))
            Column {
                Text(
                    text = "Scan Kartu e-Toll",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Bold,
                        color = PortalTheme.OnSurface
                    )
                )
                Text(
                    text = "e-Money · Flazz · TapCash · Brizzi",
                    style = MaterialTheme.typography.labelMedium.copy(color = PortalTheme.OnSurfaceVariant)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Switcher 2 Mode: Audit Perusahaan vs Cek Saldo Biasa
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            color = Color.White.copy(alpha = 0.7f),
            border = BorderStroke(1.dp, Color(0xFFE7E5E4))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val modes = listOf(
                    EtollScanMode.AUDIT_PERUSAHAAN to "Kartu Operasional",
                    EtollScanMode.CEK_SALDO_BIASA to "Cek Saldo"
                )
                modes.forEach { (mode, title) ->
                    val selected = scanMode == mode
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .clickable {
                                if (scanMode != mode) {
                                    scanMode = mode
                                    scanResponse = null
                                    lastNfcRead = null
                                    errorMessage = null
                                    infoMessage = null
                                }
                            },
                        color = if (selected) PortalTheme.Primary else Color.Transparent,
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = title,
                            color = if (selected) Color.White else PortalTheme.OnSurfaceVariant,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 9.dp, horizontal = 6.dp)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // NFC Status / Prompt Card
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            color = Color.White.copy(alpha = 0.78f),
            border = BorderStroke(1.dp, Color.White)
        ) {
            Column(
                modifier = Modifier.padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val nfcSupported = nfcAdapter != null
                val nfcEnabled = nfcAdapter?.isEnabled == true

                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(
                            when {
                                !nfcSupported -> Color(0xFFFEE2E2)
                                !nfcEnabled -> Color(0xFFFEF3C7)
                                else -> PortalTheme.PrimaryContainer
                            },
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isScanningSync) {
                        CircularProgressIndicator(color = PortalTheme.Primary, modifier = Modifier.size(34.dp))
                    } else {
                        Icon(
                            imageVector = when {
                                !nfcSupported -> Icons.Default.ErrorOutline
                                !nfcEnabled -> Icons.Default.Warning
                                else -> Icons.Default.Nfc
                            },
                            contentDescription = null,
                            tint = when {
                                !nfcSupported -> Color(0xFFDC2626)
                                !nfcEnabled -> Color(0xFFD97706)
                                else -> PortalTheme.Primary
                            },
                            modifier = Modifier.size(38.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = when {
                        isScanningSync -> "Menyinkronkan ke Dashboard Finance..."
                        !nfcSupported -> "Perangkat Tidak Mendukung NFC"
                        !nfcEnabled -> "NFC Belum Aktif"
                        else -> "Siap Scan — Tempelkan Kartu e-Toll"
                    },
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = PortalTheme.OnSurface
                    ),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = when {
                        !nfcSupported -> "Gunakan HP Android yang memiliki fitur NFC untuk memindai kartu e-Toll."
                        !nfcEnabled -> "Aktifkan NFC di pengaturan HP Anda agar kartu bisa terbaca otomatis."
                        scanMode == EtollScanMode.CEK_SALDO_BIASA -> "Mode Cek Saldo: tempelkan kartu e-Toll apa saja untuk lihat saldo (tidak tersimpan ke server)."
                        else -> "Tempelkan kartu e-Toll operasional yang sudah terdaftar selama 1–2 detik."
                    },
                    style = MaterialTheme.typography.bodySmall.copy(color = PortalTheme.OnSurfaceVariant),
                    textAlign = TextAlign.Center
                )

                if (nfcSupported && !nfcEnabled) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            runCatching {
                                context.startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PortalTheme.Primary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Buka Pengaturan NFC")
                    }
                }
            }
        }

        // Messages
        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFFEF2F2),
                border = BorderStroke(1.dp, Color(0xFFFECACA))
            ) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFDC2626))
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(errorMessage!!, color = Color(0xFF991B1B), fontSize = 13.sp)
                }
            }
        }

        if (infoMessage != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFECFDF5),
                border = BorderStroke(1.dp, Color(0xFFA7F3D0))
            ) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF059669))
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(infoMessage!!, color = Color(0xFF065F46), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
            }
        }

        // Hasil Mode Cek Saldo Biasa (Lokal / Offline, tidak masuk Dashboard Finance)
        val localRead = lastNfcRead
        if (scanMode == EtollScanMode.CEK_SALDO_BIASA && localRead != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFF0F4C5C)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = issuerDisplayName(localRead.issuer).uppercase(),
                            color = Color(0xFF99F6E4),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        Surface(color = Color.White.copy(alpha = 0.16f), shape = RoundedCornerShape(8.dp)) {
                            Text(
                                text = "CEK SALDO BIASA",
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = formatCardDigits(localRead.cardNumber),
                        color = Color.White.copy(alpha = 0.9f),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "SALDO CHIP SAAT INI",
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = formatRupiahId(localRead.balance),
                        color = Color.White,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Hanya dibaca lokal di HP · Tidak disimpan ke Dashboard Finance",
                        color = Color.White.copy(alpha = 0.72f),
                        fontSize = 11.sp
                    )
                }
            }
        }

        // Inline Register Form untuk Admin Finance / Developer jika kartu belum terdaftar
        val resp = scanResponse
        if (scanMode == EtollScanMode.AUDIT_PERUSAHAAN && resp != null && resp.code == "CARD_NOT_REGISTERED" && resp.canRegister && lastNfcRead != null) {
            Spacer(modifier = Modifier.height(14.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                border = BorderStroke(1.dp, Color(0xFFFED7AA))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Daftarkan Kartu Baru (Admin Finance / Developer)",
                        fontWeight = FontWeight.Bold,
                        color = PortalTheme.Primary,
                        fontSize = 15.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "${issuerDisplayName(lastNfcRead!!.issuer)} · ${formatCardDigits(lastNfcRead!!.cardNumber)}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        color = PortalTheme.OnSurface
                    )
                    Text(
                        "Saldo chip: ${formatRupiahId(lastNfcRead!!.balance)}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF047857)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = regLabel,
                        onValueChange = { regLabel = it },
                        label = { Text("Label Kartu (mis. e-Money GrandMax 01)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = regDivision,
                            onValueChange = { regDivision = it },
                            label = { Text("Divisi") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = regPlate,
                            onValueChange = { regPlate = it },
                            label = { Text("Plat (Opsional)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        enabled = !isRegistering && regLabel.isNotBlank(),
                        onClick = {
                            scope.launch {
                                isRegistering = true
                                val read = lastNfcRead!!
                                val res = repo.registerCard(
                                    EtollRegisterCardRequest(
                                        cardNumber = read.cardNumber,
                                        issuer = read.issuer,
                                        label = regLabel.trim(),
                                        division = regDivision.trim().ifBlank { null },
                                        vehiclePlate = regPlate.trim().ifBlank { null },
                                        initialBalance = read.balance
                                    )
                                )
                                isRegistering = false
                                res.onSuccess {
                                    regLabel = ""
                                    regPlate = ""
                                    syncReadCard(read)
                                }.onFailure { err ->
                                    errorMessage = err.message
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = PortalTheme.Primary),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(if (isRegistering) "Mendaftarkan..." else "Simpan & Sinkronkan Kartu")
                    }
                }
            }
        }

        // Hasil Scan Berhasil (Mode Kartu Operasional)
        val card = resp?.card
        if (scanMode == EtollScanMode.AUDIT_PERUSAHAAN && resp != null && resp.ok && card != null) {
            Spacer(modifier = Modifier.height(16.dp))

            // Kartu Ringkasan Saldo
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFF2C1810)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = issuerDisplayName(card.issuer).uppercase(),
                            color = Color(0xFFFDBA74),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        card.vehiclePlate?.let { plate ->
                            Surface(color = Color.White.copy(alpha = 0.14f), shape = RoundedCornerShape(8.dp)) {
                                Text(
                                    text = plate,
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = card.label,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = formatCardDigits(card.cardNumber),
                        color = Color.White.copy(alpha = 0.75f),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "SALDO CHIP SAAT INI",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = formatRupiahId(card.lastBalance),
                        color = Color.White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Pemegang: ${card.holder?.name ?: "Pool"} · Di-scan oleh: ${currentStaff?.name ?: "-"}",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 12.sp
                    )
                }
            }

            if (resp.untrackedGapAmount > 0) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFFEF2F2),
                    border = BorderStroke(1.dp, Color(0xFFFCA5A5))
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFDC2626))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "Terdeteksi selisih saldo ${formatRupiahId(resp.untrackedGapAmount)} di luar log chip. Sudah dicatat otomatis ke Dashboard Finance.",
                            fontSize = 12.sp,
                            color = Color(0xFF991B1B)
                        )
                    }
                }
            }

            if (resp.matchedTopupsCount > 0) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFECFDF5),
                    border = BorderStroke(1.dp, Color(0xFF6EE7B7))
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Verified, contentDescription = null, tint = Color(0xFF059669))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "${resp.matchedTopupsCount} catatan top-up Finance berhasil dicocokkan otomatis dengan chip!",
                            fontSize = 12.sp,
                            color = Color(0xFF065F46),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))
            Text(
                text = "Transaksi Baru Terdeteksi (${resp.newTransactions.size})",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = PortalTheme.OnSurface
                )
            )
            Text(
                text = "Opsional: pilih kategori & catatan singkat agar tim Finance tahu pemakaiannya.",
                style = MaterialTheme.typography.bodySmall.copy(color = PortalTheme.OnSurfaceVariant)
            )
            Spacer(modifier = Modifier.height(10.dp))

            if (resp.newTransactions.isEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = Color.White.copy(alpha = 0.7f)
                ) {
                    Text(
                        text = "Tidak ada transaksi baru sejak scan terakhir. Saldo sudah tercatat terkini.",
                        modifier = Modifier.padding(16.dp),
                        fontSize = 13.sp,
                        color = PortalTheme.OnSurfaceVariant
                    )
                }
            } else {
                resp.newTransactions.forEach { tx ->
                    val isTagged = taggedIds[tx.id] == true
                    val selectedCat = selectedCategoryMap[tx.id] ?: "tol"
                    val txNote = noteMap[tx.id] ?: (tx.note ?: "")

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        border = BorderStroke(
                            1.dp,
                            if (tx.source == "untracked_gap") Color(0xFFFCA5A5) else Color(0xFFE7E5E4)
                        )
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = tx.merchantLabel ?: "Transaksi e-Toll",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = PortalTheme.OnSurface
                                    )
                                    Text(
                                        text = tx.occurredAt.take(16).replace("T", " "),
                                        fontSize = 11.sp,
                                        color = PortalTheme.OnSurfaceVariant
                                    )
                                }
                                Text(
                                    text = (if (tx.txType == "topup") "+" else "-") + formatRupiahId(tx.amount),
                                    fontWeight = FontWeight.ExtraBold,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 15.sp,
                                    color = if (tx.txType == "topup") Color(0xFF047857) else Color(0xFF701604)
                                )
                            }

                            if (tx.txType == "debit") {
                                Spacer(modifier = Modifier.height(10.dp))
                                // Quick category chips (2 rows cleanly)
                                QUICK_CATEGORIES.chunked(3).forEach { rowCats ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 6.dp),
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        rowCats.forEach { (catKey, catLabel) ->
                                            val active = selectedCat == catKey
                                            Surface(
                                                modifier = Modifier
                                                    .weight(1f)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .clickable { selectedCategoryMap[tx.id] = catKey },
                                                color = if (active) PortalTheme.Primary else Color(0xFFF5F5F4),
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Text(
                                                    text = catLabel,
                                                    color = if (active) Color.White else PortalTheme.OnSurface,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    textAlign = TextAlign.Center,
                                                    modifier = Modifier.padding(vertical = 7.dp, horizontal = 4.dp)
                                                )
                                            }
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = txNote,
                                    onValueChange = { noteMap[tx.id] = it },
                                    label = { Text("Catatan singkat (mis. Tol kirim Outlet Bekasi)", fontSize = 12.sp) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    if (isTagged) {
                                        Icon(
                                            Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = Color(0xFF059669),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Tersimpan", color = Color(0xFF059669), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        Spacer(modifier = Modifier.width(10.dp))
                                    }
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                val res = repo.tagTransaction(
                                                    txId = tx.id,
                                                    category = selectedCat,
                                                    note = txNote.trim().ifBlank { null }
                                                )
                                                res.onSuccess {
                                                    taggedIds[tx.id] = true
                                                }.onFailure { err ->
                                                    errorMessage = err.message
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = PortalTheme.Primary),
                                        shape = RoundedCornerShape(10.dp),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Text(if (isTagged) "Perbarui" else "Simpan Label", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(80.dp))
    }
}
