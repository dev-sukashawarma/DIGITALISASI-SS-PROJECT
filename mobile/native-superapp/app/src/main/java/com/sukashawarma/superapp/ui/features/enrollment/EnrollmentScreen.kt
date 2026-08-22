package com.sukashawarma.superapp.ui.features.enrollment

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.utils.FaceRecognizer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

enum class EnrollPhase {
    LIST, CONSENT, CENTER, LEFT, RIGHT, SAVING, DONE
}

private object EnrollTheme {
    val Primary = Color(0xFF006686)
    val PrimaryLight = Color(0xFF0284C7)
    val PrimaryContainer = Color(0xFFE0F2FE)
    val AmberWarm = Color(0xFFD97706)
    val AmberBg = Color(0xFFFEF3C7)
    val EmeraldSuccess = Color(0xFF059669)
    val EmeraldBg = Color(0xFFD1FAE5)
    val SurfaceBg = Color(0xFFFFF8F1)
    val TextDark = Color(0xFF1E293B)
    val TextMuted = Color(0xFF64748B)
    val CardBorder = Color(0xFFE2E8F0)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EnrollmentScreen(
    adminStaff: Staff,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var staffList by remember { mutableStateOf<List<Staff>>(emptyList()) }
    var isLoadingList by remember { mutableStateOf(true) }
    var phase by remember { mutableStateOf(EnrollPhase.LIST) }
    
    var searchQuery by remember { mutableStateOf("") }
    var filterTab by remember { mutableStateOf("all") } // "all", "unenrolled", "enrolled"
    
    var selectedStaff by remember { mutableStateOf<Staff?>(null) }
    var isReEnroll by remember { mutableStateOf(false) }
    var consentChecked by remember { mutableStateOf(false) }
    var reEnrollReason by remember { mutableStateOf("") }
    
    // Camera & ML State
    var debugMessage by remember { mutableStateOf("") }
    var faceRecognizer by remember { mutableStateOf<FaceRecognizer?>(null) }
    val capturedDescriptors = remember { mutableListOf<FloatArray>() }
    var photoBytes by remember { mutableStateOf<ByteArray?>(null) }
    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }

    // Init FaceRecognizer
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            faceRecognizer = FaceRecognizer(context)
        }
    }

    // Fetch Staff List
    LaunchedEffect(adminStaff.assignedOutletId) {
        isLoadingList = true
        try {
            val list = SupabaseClient.getInstance().getStaffList(adminStaff.assignedOutletId)
            staffList = list
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoadingList = false
        }
    }
    
    val unenrolledCount = staffList.count { it.enrolledAt == null }
    val enrolledCount = staffList.count { it.enrolledAt != null }

    val filteredStaff = staffList.filter { staff ->
        val matchTab = when (filterTab) {
            "unenrolled" -> staff.enrolledAt == null
            "enrolled" -> staff.enrolledAt != null
            else -> true
        }
        val matchSearch = searchQuery.isBlank() || 
            staff.name.contains(searchQuery, ignoreCase = true) || 
            staff.role.contains(searchQuery, ignoreCase = true)
        matchTab && matchSearch
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Pendaftaran Wajah Kru",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = Color.White
                        )
                        Text(
                            "Outlet: ${adminStaff.assignedOutletId}",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (phase == EnrollPhase.LIST) onBack()
                        else {
                            phase = EnrollPhase.LIST
                            selectedStaff = null
                            capturedDescriptors.clear()
                            photoBytes = null
                            capturedBitmap = null
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = EnrollTheme.Primary
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .background(EnrollTheme.SurfaceBg)
        ) {
            when (phase) {
                EnrollPhase.LIST -> {
                    if (isLoadingList) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = EnrollTheme.Primary)
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // 1. Stats Banner
                            item {
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(16.dp),
                                    color = Color.White,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, EnrollTheme.CardBorder),
                                    shadowElevation = 2.dp
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(
                                                    "Status Enrollment Kru",
                                                    style = MaterialTheme.typography.titleMedium.copy(
                                                        fontWeight = FontWeight.Bold,
                                                        color = EnrollTheme.TextDark
                                                    )
                                                )
                                                Text(
                                                    "$enrolledCount dari ${staffList.size} kru telah terdaftar",
                                                    style = MaterialTheme.typography.bodySmall.copy(
                                                        color = EnrollTheme.TextMuted
                                                    )
                                                )
                                            }
                                            Surface(
                                                color = EnrollTheme.PrimaryContainer,
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Text(
                                                    "${if (staffList.isNotEmpty()) (enrolledCount * 100 / staffList.size) else 0}%",
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontSize = 14.sp,
                                                    color = EnrollTheme.Primary
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(12.dp))

                                        // Progress Track
                                        LinearProgressIndicator(
                                            progress = { if (staffList.isNotEmpty()) enrolledCount.toFloat() / staffList.size else 0f },
                                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                                            color = EnrollTheme.Primary,
                                            trackColor = Color(0xFFE2E8F0)
                                        )

                                        Spacer(modifier = Modifier.height(14.dp))

                                        // Summary Pills
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Surface(
                                                modifier = Modifier.weight(1f),
                                                color = EnrollTheme.AmberBg,
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Icon(Icons.Default.HourglassEmpty, null, tint = EnrollTheme.AmberWarm, modifier = Modifier.size(16.dp))
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(
                                                        "$unenrolledCount Belum",
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = EnrollTheme.AmberWarm
                                                    )
                                                }
                                            }

                                            Surface(
                                                modifier = Modifier.weight(1f),
                                                color = EnrollTheme.EmeraldBg,
                                                shape = RoundedCornerShape(10.dp)
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Icon(Icons.Default.CheckCircle, null, tint = EnrollTheme.EmeraldSuccess, modifier = Modifier.size(16.dp))
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(
                                                        "$enrolledCount Terdaftar",
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = EnrollTheme.EmeraldSuccess
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // 2. Search Box
                            item {
                                OutlinedTextField(
                                    value = searchQuery,
                                    onValueChange = { searchQuery = it },
                                    modifier = Modifier.fillMaxWidth(),
                                    placeholder = { Text("Cari nama atau role kru...") },
                                    leadingIcon = { Icon(Icons.Default.Search, null, tint = EnrollTheme.TextMuted) },
                                    trailingIcon = {
                                        if (searchQuery.isNotEmpty()) {
                                            IconButton(onClick = { searchQuery = "" }) {
                                                Icon(Icons.Default.Clear, null, tint = EnrollTheme.TextMuted)
                                            }
                                        }
                                    },
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedContainerColor = Color.White,
                                        unfocusedContainerColor = Color.White,
                                        focusedBorderColor = EnrollTheme.Primary,
                                        unfocusedBorderColor = EnrollTheme.CardBorder
                                    )
                                )
                            }

                            // 3. Filter Segment Tabs
                            item {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFFEDE8E1), RoundedCornerShape(12.dp))
                                        .padding(4.dp),
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    val tabs = listOf("all" to "Semua (${staffList.size})", "unenrolled" to "Belum ($unenrolledCount)", "enrolled" to "Sudah ($enrolledCount)")
                                    tabs.forEach { (key, label) ->
                                        val isSelected = filterTab == key
                                        Surface(
                                            modifier = Modifier
                                                .weight(1f)
                                                .clickable { filterTab = key },
                                            shape = RoundedCornerShape(8.dp),
                                            color = if (isSelected) Color.White else Color.Transparent,
                                            shadowElevation = if (isSelected) 1.dp else 0.dp
                                        ) {
                                            Text(
                                                label,
                                                modifier = Modifier.padding(vertical = 8.dp),
                                                textAlign = TextAlign.Center,
                                                fontSize = 11.sp,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                color = if (isSelected) EnrollTheme.Primary else EnrollTheme.TextMuted
                                            )
                                        }
                                    }
                                }
                            }

                            // 4. Staff Cards List
                            if (filteredStaff.isEmpty()) {
                                item {
                                    Box(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Icon(Icons.Default.PersonOff, null, tint = Color.LightGray, modifier = Modifier.size(48.dp))
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text("Tidak ada kru yang cocok dengan filter.", color = EnrollTheme.TextMuted, fontSize = 14.sp)
                                        }
                                    }
                                }
                            } else {
                                items(filteredStaff, key = { it.id }) { staff ->
                                    ModernStaffCard(
                                        staff = staff,
                                        isEnrolled = staff.enrolledAt != null,
                                        onClick = {
                                            selectedStaff = staff
                                            isReEnroll = staff.enrolledAt != null
                                            consentChecked = false
                                            reEnrollReason = ""
                                            phase = EnrollPhase.CONSENT
                                        }
                                    )
                                }
                            }
                        }
                    }
                }

                // CONSENT PHASE
                EnrollPhase.CONSENT -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        verticalArrangement = Arrangement.Center
                    ) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            color = Color.White,
                            border = androidx.compose.foundation.BorderStroke(1.dp, EnrollTheme.CardBorder),
                            shadowElevation = 4.dp
                        ) {
                            Column(modifier = Modifier.padding(24.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier.size(40.dp).background(EnrollTheme.PrimaryContainer, CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Face, null, tint = EnrollTheme.Primary, modifier = Modifier.size(22.dp))
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text("Persetujuan Biometrik", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = EnrollTheme.TextDark)
                                        Text("Pendaftaran wajah native superapp", fontSize = 12.sp, color = EnrollTheme.TextMuted)
                                    }
                                }

                                Spacer(modifier = Modifier.height(16.dp))
                                HorizontalDivider(color = EnrollTheme.CardBorder)
                                Spacer(modifier = Modifier.height(16.dp))

                                // Staff Identity Box
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    color = EnrollTheme.SurfaceBg
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier.size(44.dp).background(EnrollTheme.Primary, CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                selectedStaff?.name?.take(1)?.uppercase() ?: "K",
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White,
                                                fontSize = 18.sp
                                            )
                                        }
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(selectedStaff?.name ?: "", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = EnrollTheme.TextDark)
                                            Text("Role: ${selectedStaff?.role?.uppercase()}", fontSize = 12.sp, color = EnrollTheme.Primary, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }

                                if (isReEnroll) {
                                    Spacer(modifier = Modifier.height(14.dp))
                                    Surface(color = EnrollTheme.AmberBg, shape = RoundedCornerShape(10.dp)) {
                                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Warning, contentDescription = null, tint = EnrollTheme.AmberWarm, modifier = Modifier.size(20.dp))
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Text(
                                                "Enroll Ulang: Data wajah lama akan diganti permanen dengan rekaman baru ini.",
                                                fontSize = 12.sp,
                                                color = Color(0xFF92400E)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    OutlinedTextField(
                                        value = reEnrollReason,
                                        onValueChange = { reEnrollReason = it },
                                        label = { Text("Alasan Pendaftaran Ulang (Opsional)") },
                                        placeholder = { Text("Misal: Wajah sulit terdeteksi / ganti kacamata") },
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.height(18.dp))

                                // Consent Checkbox
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { consentChecked = !consentChecked }
                                        .background(if (consentChecked) EnrollTheme.PrimaryContainer.copy(alpha = 0.4f) else Color.Transparent, RoundedCornerShape(10.dp))
                                        .padding(8.dp)
                                ) {
                                    Checkbox(
                                        checked = consentChecked,
                                        onCheckedChange = { consentChecked = it },
                                        colors = CheckboxDefaults.colors(checkedColor = EnrollTheme.Primary)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        "Kru yang bersangkutan (${selectedStaff?.name}) telah menyetujui pemrosesan data biometrik wajah untuk keperluan absensi.",
                                        fontSize = 12.sp,
                                        color = EnrollTheme.TextDark,
                                        lineHeight = 16.sp
                                    )
                                }

                                Spacer(modifier = Modifier.height(20.dp))

                                Button(
                                    onClick = {
                                        capturedDescriptors.clear()
                                        photoBytes = null
                                        capturedBitmap = null
                                        phase = EnrollPhase.CENTER
                                    },
                                    enabled = consentChecked,
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = EnrollTheme.Primary)
                                ) {
                                    Icon(Icons.Default.CameraAlt, null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Buka Kamera & Mulai Perekaman", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // CAMERA RECORDING PHASES
                EnrollPhase.CENTER, EnrollPhase.LEFT, EnrollPhase.RIGHT -> {
                    Box(Modifier.fillMaxSize()) {
                        EnrollCameraPreview(
                            faceRecognizer = faceRecognizer,
                            currentPhase = phase,
                            onCapture = { descriptor, bitmap, nextPhase ->
                                capturedDescriptors.add(descriptor)
                                if (photoBytes == null) {
                                    capturedBitmap = bitmap
                                    val stream = ByteArrayOutputStream()
                                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
                                    photoBytes = stream.toByteArray()
                                }
                                
                                if (nextPhase == EnrollPhase.SAVING) {
                                    phase = EnrollPhase.SAVING
                                    coroutineScope.launch {
                                        try {
                                            val finalDesc = capturedDescriptors[0]
                                            val url = SupabaseClient.getInstance().uploadFaceReference(
                                                adminStaff.assignedOutletId,
                                                selectedStaff!!.id,
                                                photoBytes!!
                                            )
                                            SupabaseClient.getInstance().saveEnrollment(
                                                selectedStaff!!.id,
                                                finalDesc,
                                                url,
                                                isReEnroll,
                                                reEnrollReason,
                                                adminStaff.id,
                                                hasExistingConsent = selectedStaff!!.consentAt != null
                                            )
                                            phase = EnrollPhase.DONE
                                            staffList = staffList.map { 
                                                if (it.id == selectedStaff!!.id) it.copy(enrolledAt = "NOW") else it 
                                            }
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                            debugMessage = "Error Simpan: ${e.message}"
                                            delay(2000)
                                            phase = EnrollPhase.CONSENT
                                        }
                                    }
                                } else {
                                    phase = nextPhase
                                }
                            },
                            onError = { debugMessage = it }
                        )

                        // Top Guidance Step Pill
                        Column(
                            Modifier
                                .align(Alignment.TopCenter)
                                .padding(top = 24.dp)
                                .background(Color.Black.copy(alpha = 0.7f), RoundedCornerShape(20.dp))
                                .padding(horizontal = 20.dp, vertical = 14.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = when (phase) {
                                    EnrollPhase.CENTER -> "1. Tatap Lurus ke Kamera"
                                    EnrollPhase.LEFT -> "2. Tengok Kiri Sedikit"
                                    EnrollPhase.RIGHT -> "3. Tengok Kanan Sedikit"
                                    else -> ""
                                },
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                StepProgressDot(active = true, done = phase == EnrollPhase.LEFT || phase == EnrollPhase.RIGHT || phase == EnrollPhase.SAVING)
                                StepProgressDot(active = phase == EnrollPhase.LEFT || phase == EnrollPhase.RIGHT, done = phase == EnrollPhase.RIGHT || phase == EnrollPhase.SAVING)
                                StepProgressDot(active = phase == EnrollPhase.RIGHT, done = phase == EnrollPhase.SAVING)
                            }
                        }

                        // Oval Face Guide Frame Overlay
                        Box(
                            modifier = Modifier
                                .size(width = 240.dp, height = 310.dp)
                                .align(Alignment.Center)
                                .border(
                                    width = 3.dp,
                                    color = if (debugMessage.contains("Tatap Lurus") || debugMessage.contains("Toleh")) Color.Green else Color.White.copy(alpha = 0.7f),
                                    shape = RoundedCornerShape(120.dp)
                                )
                        )

                        // Bottom Guidance Text
                        if (debugMessage.isNotEmpty()) {
                            Surface(
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(bottom = 32.dp),
                                shape = RoundedCornerShape(12.dp),
                                color = Color.Black.copy(alpha = 0.75f)
                            ) {
                                Text(
                                    text = debugMessage,
                                    color = Color.Yellow,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }

                EnrollPhase.SAVING -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.White,
                            shadowElevation = 6.dp
                        ) {
                            Column(
                                modifier = Modifier.padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                CircularProgressIndicator(color = EnrollTheme.Primary, modifier = Modifier.size(44.dp))
                                Spacer(Modifier.height(16.dp))
                                Text("Menyimpan Ekstraksi Vektor Wajah...", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = EnrollTheme.TextDark)
                                Text("Mengunggah foto referensi ke storage aman", fontSize = 12.sp, color = EnrollTheme.TextMuted)
                            }
                        }
                    }
                }

                EnrollPhase.DONE -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Surface(
                            modifier = Modifier.padding(24.dp).fillMaxWidth(),
                            shape = RoundedCornerShape(24.dp),
                            color = Color.White,
                            border = androidx.compose.foundation.BorderStroke(1.dp, EnrollTheme.CardBorder),
                            shadowElevation = 6.dp
                        ) {
                            Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    modifier = Modifier.size(64.dp).background(EnrollTheme.EmeraldBg, CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = EnrollTheme.EmeraldSuccess, modifier = Modifier.size(40.dp))
                                }
                                Spacer(Modifier.height(16.dp))
                                Text("Pendaftaran Wajah Berhasil!", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = EnrollTheme.TextDark)
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    "Wajah ${selectedStaff?.name} telah terdaftar dan siap digunakan untuk absensi mobile.",
                                    textAlign = TextAlign.Center,
                                    fontSize = 13.sp,
                                    color = EnrollTheme.TextMuted
                                )

                                if (capturedBitmap != null) {
                                    Spacer(Modifier.height(16.dp))
                                    Image(
                                        bitmap = capturedBitmap!!.asImageBitmap(),
                                        contentDescription = "Foto Referensi",
                                        modifier = Modifier
                                            .size(90.dp)
                                            .clip(CircleShape)
                                            .border(2.dp, EnrollTheme.EmeraldSuccess, CircleShape)
                                    )
                                }

                                Spacer(Modifier.height(24.dp))
                                Button(
                                    onClick = { 
                                        phase = EnrollPhase.LIST 
                                        selectedStaff = null
                                        capturedBitmap = null
                                    },
                                    modifier = Modifier.fillMaxWidth().height(50.dp),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = EnrollTheme.Primary)
                                ) {
                                    Text("Kembali ke Daftar Kru", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StepProgressDot(active: Boolean, done: Boolean) {
    Box(
        modifier = Modifier
            .size(12.dp)
            .background(
                color = when {
                    done -> EnrollTheme.EmeraldSuccess
                    active -> EnrollTheme.PrimaryLight
                    else -> Color.Gray.copy(alpha = 0.5f)
                },
                shape = CircleShape
            )
    )
}

@Composable
private fun ModernStaffCard(staff: Staff, isEnrolled: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isEnrolled) EnrollTheme.CardBorder else EnrollTheme.AmberWarm.copy(alpha = 0.3f)
        ),
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .background(if (isEnrolled) EnrollTheme.EmeraldBg else EnrollTheme.AmberBg, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    staff.name.take(1).uppercase(),
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp,
                    color = if (isEnrolled) EnrollTheme.EmeraldSuccess else EnrollTheme.AmberWarm
                )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(staff.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = EnrollTheme.TextDark)
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        color = Color(0xFFF1F5F9),
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            staff.role.uppercase(),
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = EnrollTheme.TextMuted
                        )
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        if (isEnrolled) "Terdaftar" else "Belum Enroll",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isEnrolled) EnrollTheme.EmeraldSuccess else EnrollTheme.AmberWarm
                    )
                }
            }

            Surface(
                color = if (isEnrolled) Color(0xFFF1F5F9) else EnrollTheme.PrimaryContainer,
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        if (isEnrolled) "Enroll Ulang" else "Daftarkan",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isEnrolled) EnrollTheme.TextMuted else EnrollTheme.Primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        Icons.Default.ChevronRight,
                        null,
                        tint = if (isEnrolled) EnrollTheme.TextMuted else EnrollTheme.Primary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun EnrollCameraPreview(
    faceRecognizer: FaceRecognizer?,
    currentPhase: EnrollPhase,
    onCapture: (FloatArray, Bitmap, EnrollPhase) -> Unit,
    onError: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var isProcessing by remember { mutableStateOf(false) }
    
    val currentPhaseState by rememberUpdatedState(currentPhase)
    val onCaptureState by rememberUpdatedState(onCapture)
    val onErrorState by rememberUpdatedState(onError)

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                val imageAnalyzer = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also {
                        it.setAnalyzer(ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                            if (isProcessing) {
                                imageProxy.close()
                                return@setAnalyzer
                            }
                            
                            isProcessing = true
                            
                            val mediaImage = imageProxy.image
                            if (mediaImage != null && faceRecognizer != null && faceRecognizer.isModelLoaded) {
                                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                
                                val options = FaceDetectorOptions.Builder()
                                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                                    .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                                    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
                                    .build()
                                    
                                val detector = FaceDetection.getClient(options)
                                
                                detector.process(inputImage)
                                    .addOnSuccessListener { faces ->
                                        if (faces.isEmpty()) {
                                            onErrorState("Posisikan wajah di dalam bingkai")
                                            isProcessing = false
                                        } else {
                                            val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() } ?: faces[0]
                                            val rotY = face.headEulerAngleY
                                            
                                            val activePhase = currentPhaseState
                                            val isDirectionCorrect = when (activePhase) {
                                                EnrollPhase.CENTER -> rotY > -8 && rotY < 8
                                                EnrollPhase.LEFT -> rotY > 10
                                                EnrollPhase.RIGHT -> rotY < -10
                                                else -> false
                                            }
                                            
                                            if (isDirectionCorrect) {
                                                onErrorState("Mengekstrak Vektor...")
                                                try {
                                                    val bitmap = imageProxy.toBitmap()
                                                    if (bitmap != null) {
                                                        if (faceRecognizer.isImageTooDark(bitmap)) {
                                                            onErrorState("Pencahayaan terlalu gelap")
                                                        } else {
                                                            val bounds = face.boundingBox
                                                            val cropLeft = bounds.left.coerceIn(0, bitmap.width - 1)
                                                            val cropTop = bounds.top.coerceIn(0, bitmap.height - 1)
                                                            val cropRight = bounds.right.coerceIn(cropLeft + 1, bitmap.width)
                                                            val cropBottom = bounds.bottom.coerceIn(cropTop + 1, bitmap.height)
                                                            val cropW = cropRight - cropLeft
                                                            val cropH = cropBottom - cropTop
                                                            
                                                            val faceBitmap = Bitmap.createBitmap(bitmap, cropLeft, cropTop, cropW, cropH)
                                                            val descriptor = faceRecognizer.extractEmbedding(faceBitmap)
                                                            
                                                            val nextPhase = when (activePhase) {
                                                                EnrollPhase.CENTER -> EnrollPhase.LEFT
                                                                EnrollPhase.LEFT -> EnrollPhase.RIGHT
                                                                EnrollPhase.RIGHT -> EnrollPhase.SAVING
                                                                else -> EnrollPhase.SAVING
                                                            }
                                                            onCaptureState(descriptor, faceBitmap, nextPhase)
                                                        }
                                                    }
                                                } catch (e: Exception) {
                                                    onErrorState("Gagal potong wajah: ${e.message}")
                                                }
                                                previewView.postDelayed({ isProcessing = false }, 1000)
                                            } else {
                                                onErrorState(when(activePhase) {
                                                    EnrollPhase.CENTER -> "Harap tatap lurus (Rot: ${rotY.toInt()})"
                                                    EnrollPhase.LEFT -> "Toleh Kiri (Rot: ${rotY.toInt()})"
                                                    EnrollPhase.RIGHT -> "Toleh Kanan (Rot: ${rotY.toInt()})"
                                                    else -> ""
                                                })
                                                isProcessing = false
                                            }
                                        }
                                    }
                                    .addOnFailureListener {
                                        onErrorState("Gagal mendeteksi wajah")
                                        isProcessing = false
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            } else {
                                imageProxy.close()
                                isProcessing = false
                            }
                        }
                    }

                try {
                    cameraProvider.unbindAll()
                    val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
                    cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalyzer)
                } catch (e: Exception) {
                    onErrorState("Kamera gagal dimuat: ${e.message}")
                }
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        },
        modifier = Modifier.fillMaxSize()
    )
}
