package com.sukashawarma.superapp.ui.features.attendance

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.ImageProxy
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.TimerOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.sukashawarma.superapp.ui.components.CameraPreview
import com.sukashawarma.superapp.ui.components.GlassPanel
import com.sukashawarma.superapp.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.sukashawarma.superapp.utils.FaceRecognizer
import com.sukashawarma.superapp.utils.LocationHelper
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.data.Outlet
import java.text.SimpleDateFormat
import java.util.*

@Preview(showBackground = true)
@Composable
fun AttendanceScreenPreview() {
    SuperAppTheme {
        AttendanceScreen(staffName = "John Doe")
    }
}

@Composable
fun AttendanceScreen(
    staffName: String?,
    staffFaceDescriptor: FloatArray? = null,
    onBackClick: () -> Unit = {}
) {
    if (staffFaceDescriptor == null || staffFaceDescriptor.isEmpty()) {
        NotEnrolledScreen(staffName = staffName, onBackClick = onBackClick)
        return
    }
    val enrolledDescriptor = staffFaceDescriptor

    val coroutineScope = rememberCoroutineScope()
    var currentTime by remember { mutableStateOf("") }
    var currentDate by remember { mutableStateOf("") }

    // State Alur Absensi
    var isClockedIn by remember { mutableStateOf(false) }
    var isDayCompleted by remember { mutableStateOf(false) }
    var isScanning by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    
    var clockInTime by remember { mutableStateOf<String?>(null) }
    var clockOutTime by remember { mutableStateOf<String?>(null) }
    
    var attendanceCount by remember { mutableStateOf(18) }
    var lateCount by remember { mutableStateOf(2) }

    // State Foto / Selfie & Analisis Wajah
    
    var clockInSelfie by remember { mutableStateOf<Bitmap?>(null) }
    var clockOutSelfie by remember { mutableStateOf<Bitmap?>(null) }

    // State Geolocation
    var isLocating by remember { mutableStateOf(true) }
    var locationError by remember { mutableStateOf<String?>(null) }
    var currentDistance by remember { mutableStateOf<Double?>(null) }
    var outletData by remember { mutableStateOf<Outlet?>(null) }
    
    // Permission Launchers
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasLocationPermission = isGranted
        if (!isGranted) {
            locationError = "Izin lokasi diperlukan untuk absensi."
            isLocating = false
        }
    }
    
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
        if (isGranted) {
            isScanning = true
        }
    }

    LaunchedEffect(hasLocationPermission) {
        if (!hasLocationPermission) {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            return@LaunchedEffect
        }
        
        // Fase Locating & Validasi Pre-Absen
        isLocating = true
        locationError = null
        
        try {
            val locationHelper = LocationHelper(context)
            val loc = locationHelper.getCurrentLocation()
            
            if (loc == null) {
                locationError = "Gagal mendapatkan lokasi. Pastikan GPS menyala."
                isLocating = false
                return@LaunchedEffect
            }
            
            if (loc.accuracy > 150f) {
                locationError = "Akurasi GPS terlalu rendah (${loc.accuracy}m). Coba ke luar ruangan."
                isLocating = false
                return@LaunchedEffect
            }
            
            // Ambil data Outlet (mock / database)
            val client = SupabaseClient.getInstance()
            // Untuk percobaan, kita tembak ke outlet-1 (karena staff dummy login sebagai outlet-1)
            val outletId = "outlet-1" 
            val outlet = client.getOutlet(outletId)
            
            if (outlet == null) {
                locationError = "Data outlet tidak ditemukan."
                isLocating = false
                return@LaunchedEffect
            }
            
            outletData = outlet
            
            val distance = LocationHelper.calculateDistance(
                loc.latitude, loc.longitude, outlet.latitude, outlet.longitude
            )
            val adjustedDistance = LocationHelper.calculateAdjustedDistance(distance, loc.accuracy)
            currentDistance = adjustedDistance
            
            if (adjustedDistance > 20.0) {
                locationError = "Anda berada di luar radius outlet! (Jarak: ${adjustedDistance.toInt()}m)"
                isLocating = false
                return@LaunchedEffect
            }
            
            // Jika Geofence Lolos, Cek Status Absen Hari Ini
            val todayIn = client.getTodayAttendance("dummy-staff", "in")
            if (todayIn != null) {
                isClockedIn = true
                val todayOut = client.getTodayAttendance("dummy-staff", "out")
                if (todayOut != null) {
                    isDayCompleted = true
                } else {
                    // Ini Fase Clock-Out, Cek Gates!
                    val gates = client.checkClockOutGates(outletId)
                    if (!gates.first) {
                        locationError = gates.second // Menampilkan error checklist/petty cash
                        isLocating = false
                        return@LaunchedEffect
                    }
                }
            } else {
                isClockedIn = false
            }
            
            // Lolos semua
            isLocating = false
            
        } catch (e: Exception) {
            locationError = "Terjadi kesalahan: ${e.message}"
            isLocating = false
        }
    }

    LaunchedEffect(Unit) {
        val timeFormat = SimpleDateFormat("HH:mm", Locale.forLanguageTag("id-ID"))
        val dateFormat = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.forLanguageTag("id-ID"))
        while (true) {
            val now = Date()
            currentTime = timeFormat.format(now)
            currentDate = dateFormat.format(now)
            delay(1000)
        }
    }

    // Animasi Pulse untuk fingerprint button saat scanning
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (isScanning) 1.15f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    val backgroundGradient = Brush.linearGradient(
        colors = listOf(BackgroundStart, BackgroundEnd)
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundGradient)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 32.dp)
        ) {
            // Top App Bar
            TopBar(onBackClick)

            Spacer(modifier = Modifier.height(16.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(32.dp)
            ) {
                // Hero Section (Status & Jam)
                HeroSection(currentTime, currentDate, isClockedIn, isDayCompleted)

                if (isLocating) {
                    // Loading State
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp)
                            .background(Color.DarkGray.copy(alpha = 0.5f), RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = PrimarySuka)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Memeriksa Lokasi & Syarat Absen...", color = Color.White)
                        }
                    }
                } else if (locationError != null) {
                    // Error State
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp)
                            .background(Color(0x33FF0000), RoundedCornerShape(16.dp))
                            .border(1.dp, Color.Red, RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = "Location Error",
                                tint = Color.Red,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = locationError ?: "",
                                color = Color.White,
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = { 
                                    // Trigger LaunchedEffect again by toggling a state, or just let them go back
                                    // For simplicity, we just ask them to go back or restart
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = PrimarySuka)
                            ) {
                                Text("Coba Lagi")
                            }
                        }
                    }
                } else {
                    // Action Area (Fingerprint Scanner Button)
                    ActionArea(
                        staffName = staffName,
                        staffFaceDescriptor = enrolledDescriptor,
                        isClockedIn = isClockedIn,
                        isDayCompleted = isDayCompleted,
                        isScanning = isScanning,
                        pulseScale = pulseScale,
                        onScanTrigger = {
                            if (hasCameraPermission) {
                                isScanning = true
                            } else {
                                permissionLauncher.launch(Manifest.permission.CAMERA)
                            }
                        },
                        onFaceScanned = { bitmap ->
                            coroutineScope.launch {
                                isScanning = false
                                isSubmitting = true
                                submitError = null
                                
                                try {
                                    val client = SupabaseClient.getInstance()
                                    val tsClient = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(Date())
                                    
                                    // Bikin record DTO (mock photoUrl)
                                    val type = if (!isClockedIn) "in" else "out"
                                    val dto = com.sukashawarma.superapp.data.AttendanceRecordDto(
                                        staffId = "dummy-staff",
                                        outletId = "outlet-1",
                                        type = type,
                                        tsClient = tsClient,
                                        status = "tepat", // Secara aktual dihitung dengan jam_masuk / toleransi
                                        latitude = outletData?.latitude,
                                        longitude = outletData?.longitude,
                                        accuracy = 10.0,
                                        photoUrl = "attendance/dummy-photo.jpg",
                                        fromQueue = false
                                    )
                                    
                                    try {
                                        client.submitAttendance(dto)
                                    } catch (e: Exception) {
                                        // Offline queue fallback
                                        client.queueOfflineAction {
                                            client.submitAttendance(dto.copy(fromQueue = true))
                                        }
                                        android.util.Log.w("Attendance", "Berhasil masuk ke queue lokal karena offline")
                                    }
                                    
                                    // Update UI
                                    if (!isClockedIn) {
                                        isClockedIn = true
                                        clockInTime = currentTime
                                        clockInSelfie = bitmap
                                        attendanceCount += 1
                                    } else {
                                        isClockedIn = false
                                        isDayCompleted = true
                                        clockOutTime = currentTime
                                        clockOutSelfie = bitmap
                                    }
                                } catch (e: Exception) {
                                    submitError = "Gagal memproses absensi: ${e.message}"
                                } finally {
                                    isSubmitting = false
                                }
                            }
                        },
                        onReset = {
                            isClockedIn = false
                            isDayCompleted = false
                            isScanning = false
                            clockInTime = null
                            clockOutTime = null
                            clockInSelfie = null
                            clockOutSelfie = null
                            attendanceCount = 18
                        }
                    )
                }

                // Lokasi Card
                LocationInfoCard()

                // Data Section (Kehadiran & Keterlambatan)
                DataSection(attendanceCount, lateCount)

                // Riwayat Hari Ini dengan Foto Selfie
                HistorySection(
                    clockInTime = clockInTime,
                    clockOutTime = clockOutTime,
                    clockInSelfie = clockInSelfie,
                    clockOutSelfie = clockOutSelfie
                )
            }
        }
    }
}

@Composable
private fun NotEnrolledScreen(staffName: String?, onBackClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.Face,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(16.dp))
        Text("Wajah Belum Terdaftar", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Halo${staffName?.let { ", $it" } ?: ""}. Kamu belum punya data wajah untuk absensi di aplikasi ini. Hubungi SPV/Leader untuk pendaftaran wajah (menu Enrollment).",
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onBackClick) { Text("Kembali") }
    }
}

@Composable
private fun TopBar(onBackClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.6f))
            .padding(horizontal = 24.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBackClick) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = OnSurfaceVariant
            )
        }
        Text(
            text = "Absensi",
            style = MaterialTheme.typography.headlineMedium,
            color = PrimarySuka
        )
        IconButton(onClick = { /* Help */ }) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.HelpOutline,
                contentDescription = "Help",
                tint = OnSurfaceVariant
            )
        }
    }
}

@Composable
private fun HeroSection(time: String, date: String, isClockedIn: Boolean, isDayCompleted: Boolean) {
    GlassPanel(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Dynamic Status Badge
            val (badgeText, badgeColor) = when {
                isDayCompleted -> "Selesai Kerja" to TertiarySuka
                isClockedIn -> "Sudah Absen Masuk" to Color(0xFF2E7D32)
                else -> "Belum Absen" to ErrorRed
            }

            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(SurfaceVariant.copy(alpha = 0.5f))
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(badgeColor)
                )
                Text(
                    text = badgeText,
                    style = MaterialTheme.typography.labelMedium,
                    color = OnSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = time.ifEmpty { "00:00" },
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontSize = 48.sp,
                    lineHeight = 52.sp
                ),
                color = PrimarySuka
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = date.ifEmpty { "Memuat tanggal..." },
                style = MaterialTheme.typography.bodySmall,
                color = OnSurfaceVariant
            )
        }
    }
}

enum class LivenessState { INIT, STRAIGHT, RIGHT, LEFT, MATCHING, VERIFIED }

@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable
private fun ActionArea(
    staffName: String?,
    staffFaceDescriptor: FloatArray,
    isClockedIn: Boolean,
    isDayCompleted: Boolean,
    isScanning: Boolean,
    pulseScale: Float,
    onScanTrigger: () -> Unit,
    onFaceScanned: (Bitmap) -> Unit,
    onReset: () -> Unit
) {
    var faceDetected by remember { mutableStateOf(false) }
    var detectedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var livenessState by remember { mutableStateOf(LivenessState.INIT) }
    var debugMessage by remember { mutableStateOf("") }
    var failedVerifyCount by remember { mutableStateOf(0) }
    var isProcessing by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val faceRecognizer = remember { com.sukashawarma.superapp.utils.FaceRecognizer(context) }

    LaunchedEffect(isScanning) {
        if (isScanning) {
            // Selalu reset semua state dari awal setiap kali kamera terbuka
            // Ini mencegah bug di mana Clock-Out langsung lolos karena state lama belum terhapus
            livenessState = LivenessState.INIT
            debugMessage = ""
            failedVerifyCount = 0
            faceDetected = false
            detectedBitmap = null
            isProcessing = false
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Status Text & Reset Link
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = when {
                    isDayCompleted -> "Kerja hari ini selesai. Terima kasih!"
                    isClockedIn -> "Sudah absen masuk. Bekerja di Outlet Utama."
                    else -> "Silakan ambil foto & ketuk untuk absen masuk."
                },
                style = MaterialTheme.typography.bodySmall,
                color = OnSurfaceVariant,
                modifier = Modifier.weight(1f)
            )
            if (isClockedIn || isDayCompleted) {
                IconButton(onClick = onReset, modifier = Modifier.size(24.dp)) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Reset State",
                        tint = PrimarySuka.copy(alpha = 0.6f),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Fingerprint Button Container
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(320.dp)
        ) {
            // Ring Animasi Latar (Pulse Effect)
            if (isScanning) {
                Box(
                    modifier = Modifier
                        .size(280.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(PrimarySuka.copy(alpha = 0.15f))
                )
            }

            // Tombol Utama
            val buttonColor = when {
                isDayCompleted -> Color.Gray
                isClockedIn -> Color(0xFF701604) // Warna gelap/merah bata untuk Clock Out
                else -> PrimarySuka
            }

            val buttonText = when {
                isScanning -> "Memindai..."
                isDayCompleted -> "Selesai"
                isClockedIn -> "Mulai\nClock-Out"
                else -> "Mulai\nClock-In"
            }

            Box(
                modifier = Modifier
                    .size(280.dp)
                    .shadow(
                        elevation = if (isScanning) 8.dp else 20.dp,
                        shape = CircleShape,
                        spotColor = buttonColor,
                        ambientColor = buttonColor
                    )
                    .clip(CircleShape)
                    .background(buttonColor)
                    .clickable(enabled = !isDayCompleted && !isScanning) { onScanTrigger() },
                contentAlignment = Alignment.Center
            ) {
                if (isScanning) {
                    // Tampilkan Camera Preview di dalam lingkaran
                    CameraPreview(
                        modifier = Modifier.fillMaxSize(),
                        onFaceDetected = { detected -> 
                            // We handle detection in onImageCaptureReady
                        },
                        onImageCaptureReady = { imageProxy ->
                            if (isProcessing) {
                                imageProxy.close()
                                return@CameraPreview
                            }
                            val mediaImage = imageProxy.image
                            if (mediaImage != null) {
                                isProcessing = true
                                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                val options = FaceDetectorOptions.Builder()
                                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                                    .build()
                                val detector = FaceDetection.getClient(options)
                                
                                detector.process(inputImage)
                                    .addOnSuccessListener { faces ->
                                        if (faces.isNotEmpty()) {
                                            faceDetected = true
                                            // Jika ada banyak wajah (misal poster di belakang), pilih yang paling besar (paling dekat)
                                            val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() } ?: faces[0]
                                            val eulerY = face.headEulerAngleY
                                            // Liveness State Machine (Identity First, Liveness Second)
                                            when (livenessState) {
                                                LivenessState.INIT -> {
                                                    // Begitu wajah menghadap ke depan, langsung ekstrak dan cocokkan!
                                                    if (eulerY in -15f..15f) {
                                                        try {
                                                            detectedBitmap = imageProxy.toBitmap()
                                                            val bitmap = detectedBitmap
                                                            
                                                            if (bitmap != null) {
                                                                if (!faceRecognizer.isModelLoaded) {
                                                                    livenessState = LivenessState.INIT
                                                                    debugMessage = "Model Error: ${faceRecognizer.loadError}"
                                                                } else if (faceRecognizer.isImageTooDark(bitmap)) {
                                                                    livenessState = LivenessState.INIT
                                                                    debugMessage = "Ruangan terlalu gelap"
                                                                } else {
                                                                    livenessState = LivenessState.MATCHING
                                                                    debugMessage = "Mengekstrak..."
                                                                    
                                                                    // Face cropping WAJIB untuk FaceNet
                                                                    // Tanpa crop, background dominasi embedding (Sim~0.05)
                                                                    val bounds = face.boundingBox
                                                                    // Clamp bounds agar tidak keluar dari bitmap
                                                                    val cropLeft = bounds.left.coerceIn(0, bitmap.width - 1)
                                                                    val cropTop = bounds.top.coerceIn(0, bitmap.height - 1)
                                                                    val cropRight = bounds.right.coerceIn(cropLeft + 1, bitmap.width)
                                                                    val cropBottom = bounds.bottom.coerceIn(cropTop + 1, bitmap.height)
                                                                    val cropW = cropRight - cropLeft
                                                                    val cropH = cropBottom - cropTop
                                                                    
                                                                    val faceBitmap = android.graphics.Bitmap.createBitmap(bitmap, cropLeft, cropTop, cropW, cropH)
                                                                    val embedding = faceRecognizer.extractEmbedding(faceBitmap)
                                                                    
                                                                    if (embedding.isNotEmpty()) {
                                                                        if (staffFaceDescriptor.size != embedding.size) {
                                                                            livenessState = LivenessState.INIT
                                                                            debugMessage = "Data wajah tidak cocok dengan model (${staffFaceDescriptor.size}d vs ${embedding.size}d). Hubungi SPV untuk enroll ulang."
                                                                        } else {
                                                                            val similarity = FaceRecognizer.cosineSimilarity(embedding, staffFaceDescriptor)
                                                                            android.util.Log.d("FACE_MATCH", "Sim=$similarity (dims ${embedding.size})")
                                                                            if (similarity >= FaceRecognizer.MOBILE_MATCH_THRESHOLD) {
                                                                                livenessState = LivenessState.STRAIGHT
                                                                                debugMessage = "Cocok! (Sim: ${String.format("%.4f", similarity)})"
                                                                            } else {
                                                                                livenessState = LivenessState.INIT
                                                                                debugMessage = "Wajah tidak cocok (Sim: ${String.format("%.4f", similarity)})"
                                                                            }
                                                                        }
                                                                    } else {
                                                                        livenessState = LivenessState.INIT
                                                                        debugMessage = "Gagal Ekstrak Embedding"
                                                                    }
                                                                }
                                                            } else {
                                                                debugMessage = "Bitmap Null"
                                                            }
                                                        } catch (e: Exception) {
                                                            livenessState = LivenessState.INIT
                                                            debugMessage = "Error: ${e.message}"
                                                        }
                                                    } else {
                                                        debugMessage = "Tatap layar lurus (Angle: $eulerY)"
                                                    }
                                                }
                                                LivenessState.STRAIGHT -> {
                                                    if (eulerY < -15f) livenessState = LivenessState.RIGHT
                                                }
                                                LivenessState.RIGHT -> {
                                                    if (eulerY > 15f) livenessState = LivenessState.LEFT
                                                }
                                                LivenessState.LEFT -> {
                                                    if (eulerY in -15f..15f) {
                                                        // VERIFIKASI FINAL: Pastikan wajah yang selesai liveness adalah wajah yang sama
                                                        try {
                                                            val finalBitmap = imageProxy.toBitmap()
                                                            if (finalBitmap != null) {
                                                                val bounds = face.boundingBox
                                                                val cropLeft = bounds.left.coerceIn(0, finalBitmap.width - 1)
                                                                val cropTop = bounds.top.coerceIn(0, finalBitmap.height - 1)
                                                                val cropRight = bounds.right.coerceIn(cropLeft + 1, finalBitmap.width)
                                                                val cropBottom = bounds.bottom.coerceIn(cropTop + 1, finalBitmap.height)
                                                                
                                                                val faceBitmap = android.graphics.Bitmap.createBitmap(finalBitmap, cropLeft, cropTop, cropRight - cropLeft, cropBottom - cropTop)
                                                                val finalEmbedding = faceRecognizer.extractEmbedding(faceBitmap)
                                                                
                                                                if (finalEmbedding.isNotEmpty()) {
                                                                    val similarity = FaceRecognizer.cosineSimilarity(finalEmbedding, staffFaceDescriptor)
                                                                    if (similarity >= FaceRecognizer.MOBILE_MATCH_THRESHOLD) {
                                                                        livenessState = LivenessState.VERIFIED
                                                                        failedVerifyCount = 0
                                                                    } else {
                                                                        failedVerifyCount++
                                                                        if (failedVerifyCount > 5) {
                                                                            livenessState = LivenessState.INIT
                                                                            debugMessage = "GAGAL: Wajah tidak sama! (Sim: ${String.format("%.4f", similarity)})"
                                                                            failedVerifyCount = 0
                                                                        } else {
                                                                            // Jangan langsung reset ke INIT. Biarkan user mencoba frame berikutnya.
                                                                            // Jika ini wajah temannya, dia akan tertahan di sini selamanya.
                                                                            // Jika ini wajah asli, frame berikutnya (setelah fokus kamera stabil) pasti akan lolos.
                                                                            debugMessage = "Mencocokkan ulang... ($failedVerifyCount/5)"
                                                                        }
                                                                    }
                                                                } else {
                                                                    livenessState = LivenessState.INIT
                                                                    debugMessage = "Gagal verifikasi final — ulangi dari awal"
                                                                }
                                                            }
                                                        } catch (e: Exception) {
                                                            livenessState = LivenessState.INIT
                                                            debugMessage = "Error final verify: ${e.message}"
                                                        }
                                                    }
                                                }
                                                else -> {}
                                            }
                                        } else {
                                            faceDetected = false
                                            // Jangan langsung reset state ke INIT di sini.
                                            // Wajah bisa hilang sesaat karena blur saat menoleh (kamera HP).
                                            // Keamanan sudah dijamin oleh "Verifikasi Final" di tahap akhir.
                                            debugMessage = "Tidak ada wajah"
                                        }
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                        isProcessing = false
                                    }
                            } else {
                                imageProxy.close()
                                debugMessage = "MediaImage Null"
                                isProcessing = false
                            }
                        }
                    )
                    
                    // Indikator Wajah (Bingkai Hijau/Merah/Kuning)
                    val frameColor = when (livenessState) {
                        LivenessState.VERIFIED -> Color.Green
                        LivenessState.MATCHING -> Color.Yellow
                        LivenessState.INIT -> Color.Red
                        else -> PrimarySuka
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .border(width = 4.dp, color = frameColor, shape = CircleShape)
                    )
                    
                    // Teks Instruksi
                    val instructionText = when (livenessState) {
                        LivenessState.INIT -> "Arahkan Wajah"
                        LivenessState.STRAIGHT -> "Halo, ${staffName ?: "Karyawan"}!\nSilakan Toleh Kanan"
                        LivenessState.RIGHT -> "Silakan Toleh Kiri"
                        LivenessState.LEFT -> "Kembali menatap lurus"
                        LivenessState.MATCHING -> "Mengekstrak Vektor..."
                        LivenessState.VERIFIED -> "Wajah Cocok!"
                    }
                    
                    Column(
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = if (livenessState == LivenessState.VERIFIED) 64.dp else 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = instructionText,
                            color = Color.White,
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier
                                .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                                .padding(8.dp)
                        )
                        
                        if (debugMessage.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = debugMessage,
                                color = Color.Yellow,
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                modifier = Modifier
                                    .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    
                    // Tombol Ambil Absen Muncul Saat Liveness & Matching Selesai
                    if (livenessState == LivenessState.VERIFIED) {
                        LaunchedEffect(Unit) {
                            kotlinx.coroutines.delay(1000) // Tahan 1 detik biar user lihat centangnya
                            detectedBitmap?.let { onFaceScanned(it) } 
                            // Reset state untuk absensi berikutnya
                            livenessState = LivenessState.INIT
                        }
                        
                        androidx.compose.animation.AnimatedVisibility(
                            visible = true,
                            enter = androidx.compose.animation.scaleIn() + androidx.compose.animation.fadeIn(),
                            modifier = Modifier.align(Alignment.Center)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = "Verified",
                                tint = Color.Green,
                                modifier = Modifier
                                    .size(120.dp)
                                    .background(Color.White, CircleShape)
                            )
                        }
                    }
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = "Clock Action",
                            tint = OnPrimary,
                            modifier = Modifier.size(44.dp)
                        )
                        Text(
                            text = buttonText,
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontSize = 20.sp,
                                lineHeight = 24.sp
                            ),
                            color = OnPrimary,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Sistem akan mendeteksi foto wajah dan lokasi Anda secara otomatis.",
            style = MaterialTheme.typography.bodySmall,
            color = OnSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(220.dp)
        )
    }
}

@Composable
private fun LocationInfoCard() {
    GlassPanel(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                tint = PrimarySuka,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(
                    text = "Lokasi Saat Ini",
                    style = MaterialTheme.typography.labelMedium,
                    color = OnSurfaceVariant
                )
                Text(
                    text = "Outlet Utama (Dalam Radius 50m)",
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
                    color = OnSurface
                )
            }
        }
    }
}

@Composable
private fun DataSection(attendanceCount: Int, lateCount: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Left Card (Kehadiran)
        GlassPanel(
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(TertiaryContainer.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = null,
                        tint = TertiarySuka,
                        modifier = Modifier.size(18.dp)
                    )
                }
                
                Text(
                    text = "Kehadiran Bulan Ini",
                    style = MaterialTheme.typography.labelMedium.copy(fontSize = 11.sp),
                    color = OnSurfaceVariant
                )
                
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "$attendanceCount ",
                        style = MaterialTheme.typography.headlineLarge,
                        color = OnSurface
                    )
                    Text(
                        text = "Hari",
                        style = MaterialTheme.typography.bodySmall,
                        color = OnSurfaceVariant,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                }
            }
        }

        // Right Card (Terlambat)
        GlassPanel(
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(ErrorContainer.copy(alpha = 0.5f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.TimerOff,
                        contentDescription = null,
                        tint = ErrorRed,
                        modifier = Modifier.size(18.dp)
                    )
                }
                
                Text(
                    text = "Terlambat",
                    style = MaterialTheme.typography.labelMedium.copy(fontSize = 11.sp),
                    color = OnSurfaceVariant
                )
                
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = "$lateCount ",
                        style = MaterialTheme.typography.headlineLarge,
                        color = ErrorRed
                    )
                    Text(
                        text = "Kali",
                        style = MaterialTheme.typography.bodySmall,
                        color = OnSurfaceVariant,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun HistorySection(
    clockInTime: String?, 
    clockOutTime: String?,
    clockInSelfie: Bitmap?,
    clockOutSelfie: Bitmap?
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Riwayat Hari Ini",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            ),
            color = OnSurface
        )

        if (clockInTime == null && clockOutTime == null) {
            GlassPanel(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Belum ada riwayat absensi hari ini.",
                        style = MaterialTheme.typography.bodySmall,
                        color = OnSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                clockOutTime?.let { time ->
                    HistoryItem(
                        type = "Clock Out",
                        time = time,
                        location = "Outlet Utama",
                        iconColor = Color(0xFF701604),
                        selfie = clockOutSelfie
                    )
                }
                clockInTime?.let { time ->
                    HistoryItem(
                        type = "Clock In",
                        time = time,
                        location = "Outlet Utama",
                        iconColor = Color(0xFF2E7D32),
                        selfie = clockInSelfie
                    )
                }
            }
        }
    }
}

@Composable
private fun HistoryItem(
    type: String,
    time: String,
    location: String,
    iconColor: Color,
    selfie: Bitmap?
) {
    GlassPanel(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Tampilkan foto selfie jika ada, jika tidak tampilkan ikon centang default
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(iconColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                if (selfie != null) {
                    Image(
                        bitmap = selfie.asImageBitmap(),
                        contentDescription = "User Selfie",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = iconColor,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = type,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = OnSurface
                )
                Text(
                    text = location,
                    fontSize = 12.sp,
                    color = OnSurfaceVariant
                )
            }
            Text(
                text = time,
                fontWeight = FontWeight.Bold,
                color = OnSurface,
                fontSize = 14.sp
            )
        }
    }
}
