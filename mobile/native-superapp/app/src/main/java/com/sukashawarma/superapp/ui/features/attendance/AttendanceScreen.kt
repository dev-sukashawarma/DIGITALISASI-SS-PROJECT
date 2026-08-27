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
import androidx.compose.foundation.Canvas
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
import com.sukashawarma.superapp.R
import androidx.compose.ui.res.painterResource
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.Login

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
    staffId: String? = null,
    outletId: String? = null,
    onBackClick: () -> Unit = {}
) {
    if (staffFaceDescriptor == null || staffFaceDescriptor.isEmpty()) {
        NotEnrolledScreen(staffName = staffName, onBackClick = onBackClick)
        return
    }
    if (staffId.isNullOrBlank() || outletId.isNullOrBlank()) {
        ProfileIncompleteScreen(onBackClick = onBackClick)
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
    var offlineNotice by remember { mutableStateOf<String?>(null) }
    
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

    // Lokasi DEVICE nyata (bukan koordinat outlet) â€” dikirim ke server untuk validasi geofence
    var deviceLat by remember { mutableStateOf<Double?>(null) }
    var deviceLng by remember { mutableStateOf<Double?>(null) }
    var deviceAccuracy by remember { mutableStateOf<Double?>(null) }
    
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

            // Simpan lokasi device nyata untuk dikirim saat submit
            deviceLat = loc.latitude
            deviceLng = loc.longitude
            deviceAccuracy = loc.accuracy.toDouble()

            // Ambil data Outlet milik staff yang login
            val client = SupabaseClient.getInstance()
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
            // Gate clock-out (shift kasir masih terbuka, dll.) dievaluasi SERVER saat submit â€”
            // ditolak dengan reason (mis. "shift_not_closed") yang sudah di-map ke pesan Indonesia.
            val todayIn = client.getTodayAttendance(staffId, "in")
            if (todayIn != null) {
                isClockedIn = true
                val todayOut = client.getTodayAttendance(staffId, "out")
                if (todayOut != null) {
                    isDayCompleted = true
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
            .background(Color(0xFFF8F9FB))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 80.dp) // space for bottom nav
        ) {
            // Top App Bar
            TopBar(staffName = staffName, onBackClick = onBackClick)

            Spacer(modifier = Modifier.height(24.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Greeting
                GreetingSection(staffName)
                
                if (isLocating) {
                    LoadingLocationCard()
                } else if (locationError != null) {
                    ErrorLocationCard(locationError!!)
                } else {
                    // Action Area (Camera Scanner)
                    ActionArea(
                        staffName = staffName,
                        staffFaceDescriptor = enrolledDescriptor,
                        isClockedIn = isClockedIn,
                        isDayCompleted = isDayCompleted,
                        isScanning = isScanning,
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

                                    val type = if (!isClockedIn) "in" else "out"
                                    val req = com.sukashawarma.superapp.data.AttendanceSubmitRequest(
                                        id = java.util.UUID.randomUUID().toString(),
                                        outletStaffId = staffId,
                                        outletId = outletId,
                                        type = type,
                                        tsClient = tsClient,
                                        gpsLat = deviceLat,
                                        gpsLng = deviceLng,
                                        gpsAccuracy = deviceAccuracy,
                                        matchDistance = null,
                                        selfiePath = null,
                                        fromQueue = false
                                    )

                                    var accepted = false
                                    try {
                                        val resp = client.submitAttendance(req)
                                        if (resp.ok) {
                                            accepted = true
                                            offlineNotice = null
                                        } else {
                                            submitError = com.sukashawarma.superapp.data.SubmitFailureMessages.forReason(resp.reason)
                                        }
                                    } catch (e: com.sukashawarma.superapp.data.AttendanceServerException) {
                                        submitError = e.message
                                    } catch (e: Exception) {
                                        client.queueOfflineAction {
                                            val resp = client.submitAttendance(req.copy(fromQueue = true))
                                            if (!resp.ok) {
                                                android.util.Log.w("OfflineQueue", "Absensi ditolak saat sync: ${resp.reason}")
                                            }
                                        }
                                        android.util.Log.w("Attendance", "Berhasil masuk ke queue lokal karena offline")
                                        offlineNotice = "Tersimpan offline — akan dikirim otomatis saat online."
                                        accepted = true
                                    }

                                    if (accepted) {
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

                offlineNotice?.let { message ->
                    NoticeCard(message, isError = false)
                }

                submitError?.let { message ->
                    NoticeCard(message, isError = true)
                }

                // Data Section (Status Hari ini)
                StatusHariIniSection(currentDate, isClockedIn, isDayCompleted)

                // Riwayat Hari Ini
                HistorySection(
                    clockInTime = clockInTime,
                    clockOutTime = clockOutTime,
                    clockInSelfie = clockInSelfie,
                    clockOutSelfie = clockOutSelfie
                )
            }
        }
        
        // Bottom Navigation Bar
        Box(modifier = Modifier.align(Alignment.BottomCenter)) {
            BottomNavBar()
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
private fun ProfileIncompleteScreen(onBackClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.LocationOn,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(16.dp))
        Text("Profil Tidak Lengkap", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Profil tidak lengkap (outlet belum terikat). Hubungi admin.",
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onBackClick) { Text("Kembali") }
    }
}

@Composable
private fun TopBar(staffName: String?, onBackClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp))
            .padding(start = 24.dp, end = 24.dp, top = 48.dp, bottom = 24.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "Profile",
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .border(1.dp, Color(0xFFEEEEEE), CircleShape)
                    .background(Color.White),
                contentScale = ContentScale.Inside
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "Suka Culinary",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color.Black
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "SUKAABSEN OUTLET",
                        fontSize = 10.sp,
                        color = Color.Gray,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .background(Color(0xFFE8F5E9), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Online",
                            fontSize = 9.sp,
                            color = Color(0xFF2E7D32),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
        
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(Color(0xFFEEF0FC), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.NotificationsNone,
                contentDescription = "Notification",
                tint = Color.Black,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
private fun GreetingSection(staffName: String?) {
    Column {
        Text(
            text = "Halo, ${staffName ?: "tes"}!",
            fontWeight = FontWeight.ExtraBold,
            fontSize = 24.sp,
            color = Color(0xFF11142D)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Anda berada di outlet tes",
            fontSize = 14.sp,
            color = Color.Gray
        )
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

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(420.dp)
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFF2B2F3A), Color(0xFF1A1C23))
                ),
                shape = RoundedCornerShape(24.dp)
            )
            .clip(RoundedCornerShape(24.dp))
            .clickable(enabled = !isDayCompleted && !isScanning) { onScanTrigger() },
        contentAlignment = Alignment.Center
    ) {
        if (isScanning) {
            CameraPreview(
                modifier = Modifier.fillMaxSize(),
                onFaceDetected = { },
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
                                                                    debugMessage = "Gagal verifikasi final â€” ulangi dari awal"
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
                    

                    // Indikator Wajah
                    val instructionText = when (livenessState) {
                        LivenessState.INIT -> "Arahkan Wajah"
                        LivenessState.STRAIGHT -> "Silakan Toleh Kanan"
                        LivenessState.RIGHT -> "Silakan Toleh Kiri"
                        LivenessState.LEFT -> "Kembali menatap lurus"
                        LivenessState.MATCHING -> "Mengekstrak Vektor..."
                        LivenessState.VERIFIED -> "Wajah Cocok!"
                    }
                    
                    Column(
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp),
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
                    
                    if (livenessState == LivenessState.VERIFIED) {
                        LaunchedEffect(Unit) {
                            kotlinx.coroutines.delay(1000)
                            detectedBitmap?.let { onFaceScanned(it) } 
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
            // Scanner UI placeholder when not scanning
            // Drawing the orange corners
            Canvas(modifier = Modifier.fillMaxSize()) {
                val cornerLength = 40.dp.toPx()
                val strokeW = 4.dp.toPx()
                val color = Color(0xFFFF9800)
                val padding = 40.dp.toPx()
                val radius = 16.dp.toPx()
                
                // Top Left
                drawPath(
                    path = androidx.compose.ui.graphics.Path().apply {
                        moveTo(padding, padding + cornerLength)
                        lineTo(padding, padding + radius)
                        quadraticBezierTo(padding, padding, padding + radius, padding)
                        lineTo(padding + cornerLength, padding)
                    },
                    color = color,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeW, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                )
                
                // Top Right
                drawPath(
                    path = androidx.compose.ui.graphics.Path().apply {
                        moveTo(size.width - padding - cornerLength, padding)
                        lineTo(size.width - padding - radius, padding)
                        quadraticBezierTo(size.width - padding, padding, size.width - padding, padding + radius)
                        lineTo(size.width - padding, padding + cornerLength)
                    },
                    color = color,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeW, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                )
                
                // Bottom Left
                drawPath(
                    path = androidx.compose.ui.graphics.Path().apply {
                        moveTo(padding, size.height - padding - cornerLength)
                        lineTo(padding, size.height - padding - radius)
                        quadraticBezierTo(padding, size.height - padding, padding + radius, size.height - padding)
                        lineTo(padding + cornerLength, size.height - padding)
                    },
                    color = color,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeW, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                )
                
                // Bottom Right
                drawPath(
                    path = androidx.compose.ui.graphics.Path().apply {
                        moveTo(size.width - padding, size.height - padding - cornerLength)
                        lineTo(size.width - padding, size.height - padding - radius)
                        quadraticBezierTo(size.width - padding, size.height - padding, size.width - padding - radius, size.height - padding)
                        lineTo(size.width - padding - cornerLength, size.height - padding)
                    },
                    color = color,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeW, cap = androidx.compose.ui.graphics.StrokeCap.Round)
                )
            }
            
            Text(
                text = "Arahkan wajah ke kamera",
                color = Color.White,
                fontSize = 12.sp,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp)
            )
            
            // Top orange glow
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .align(Alignment.TopCenter)
                    .background(
                        brush = Brush.horizontalGradient(
                            colors = listOf(Color.Transparent, Color(0xFFFF9800), Color.Transparent)
                        )
                    )
            )
        }
    }
}
@Composable
private fun StatusHariIniSection(date: String, isClockedIn: Boolean, isDayCompleted: Boolean) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF0F0F0))
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Status Hari ini",
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = Color(0xFF544437)
            )
            Text(
                text = date.ifEmpty { "Kamis, 20 Agustus 2026" },
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = Color.Black
            )
            
            val (badgeText, badgeColor, badgeBg) = when {
                isDayCompleted -> Triple("Selesai Bekerja", Color(0xFF1565C0), Color(0xFFE3F2FD))
                isClockedIn -> Triple("Sedang Bekerja", Color(0xFFFF9800), Color(0xFFFFF3E0))
                else -> Triple("Belum Bekerja", Color.Gray, Color(0xFFF5F5F5))
            }
            
            Row(
                modifier = Modifier
                    .background(badgeBg, RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(modifier = Modifier.size(6.dp).background(badgeColor, CircleShape))
                Text(
                    text = badgeText,
                    fontSize = 12.sp,
                    color = badgeColor,
                    fontWeight = FontWeight.Bold
                )
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
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Riwayat Absensi Terakhir",
            fontWeight = FontWeight.ExtraBold,
            fontSize = 16.sp,
            color = Color.Black
        )

        HistoryItemCard(
            type = "Clock In",
            time = clockInTime ?: "08:00 WIB",
            isToday = true,
            isClockIn = true
        )
        
        HistoryItemCard(
            type = "Clock Out",
            time = clockOutTime ?: "17:00 WIB",
            isToday = false,
            isClockIn = false
        )
    }
}

@Composable
private fun HistoryItemCard(
    type: String,
    time: String,
    isToday: Boolean,
    isClockIn: Boolean
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF0F0F0))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(if (isClockIn) Color(0xFFE8F5E9) else Color(0xFFFFEBEE), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isClockIn) Icons.AutoMirrored.Filled.Login else Icons.AutoMirrored.Filled.ExitToApp,
                    contentDescription = type,
                    tint = if (isClockIn) Color(0xFF2E7D32) else Color(0xFFD32F2F),
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = type,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color.Black
                )
                Text(
                    text = time,
                    fontSize = 14.sp,
                    color = Color.Gray
                )
            }
            
            Box(
                modifier = Modifier
                    .background(Color(0xFFEEF0FC), RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = if (isToday) "Hari ini" else "Kemarin",
                    fontSize = 12.sp,
                    color = Color.Black,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun NoticeCard(message: String, isError: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isError) Color(0xFFFFEBEE) else Color(0xFFFFF3E0), RoundedCornerShape(12.dp))
            .border(1.dp, if (isError) Color(0xFFD32F2F) else Color(0xFFFF9800), RoundedCornerShape(12.dp))
            .padding(16.dp)
    ) {
        Text(
            text = message,
            color = if (isError) Color(0xFFD32F2F) else Color(0xFFE65100),
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun LoadingLocationCard() {
    Surface(
        modifier = Modifier.fillMaxWidth().height(100.dp),
        shape = RoundedCornerShape(24.dp),
        color = Color.White
    ) {
        Box(contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Color(0xFFFF9800))
        }
    }
}

@Composable
private fun ErrorLocationCard(error: String) {
    NoticeCard(message = error, isError = true)
}

@Composable
private fun BottomNavBar() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shadowElevation = 16.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            BottomNavItem(icon = Icons.Default.Home, label = "Home", isSelected = true)
            BottomNavItem(icon = Icons.Default.Checklist, label = "Checklist", isSelected = false)
            BottomNavItem(icon = Icons.Default.Person, label = "Profile", isSelected = false)
            BottomNavItem(icon = Icons.Default.MoreHoriz, label = "More", isSelected = false)
        }
    }
}

@Composable
private fun BottomNavItem(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, isSelected: Boolean) {
    if (isSelected) {
        Row(
            modifier = Modifier
                .background(Color(0xFFFF9800), RoundedCornerShape(24.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(imageVector = icon, contentDescription = label, tint = Color.Black, modifier = Modifier.size(20.dp))
            Text(text = label, color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    } else {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(12.dp)
        ) {
            Icon(imageVector = icon, contentDescription = label, tint = Color.Gray, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = label, color = Color.Gray, fontSize = 10.sp)
        }
    }
}
