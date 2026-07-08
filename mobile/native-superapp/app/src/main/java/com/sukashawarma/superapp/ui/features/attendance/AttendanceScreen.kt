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
    val coroutineScope = rememberCoroutineScope()
    var currentTime by remember { mutableStateOf("") }
    var currentDate by remember { mutableStateOf("") }

    // State Alur Absensi
    var isClockedIn by remember { mutableStateOf(false) }
    var isDayCompleted by remember { mutableStateOf(false) }
    var isScanning by remember { mutableStateOf(false) }
    
    var clockInTime by remember { mutableStateOf<String?>(null) }
    var clockOutTime by remember { mutableStateOf<String?>(null) }
    
    var attendanceCount by remember { mutableStateOf(18) }
    var lateCount by remember { mutableStateOf(2) }

    // State Foto / Selfie & Analisis Wajah
    
    var clockInSelfie by remember { mutableStateOf<Bitmap?>(null) }
    var clockOutSelfie by remember { mutableStateOf<Bitmap?>(null) }

    // Camera Permission Launcher
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
        if (isGranted) {
            isScanning = true
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

                // Action Area (Fingerprint Scanner Button)
                ActionArea(
                    staffName = staffName,
                    staffFaceDescriptor = staffFaceDescriptor,
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

                // Tombol sementara untuk Bypass Scan Wajah di Emulator tanpa Webcam
                Button(
                    onClick = {
                        val dummyBitmap = android.graphics.Bitmap.createBitmap(1, 1, android.graphics.Bitmap.Config.ARGB_8888)
                        coroutineScope.launch {
                            isScanning = false
                            if (!isClockedIn) {
                                isClockedIn = true
                                clockInTime = currentTime
                                clockInSelfie = dummyBitmap
                                attendanceCount += 1
                            } else {
                                isClockedIn = false
                                isDayCompleted = true
                                clockOutTime = currentTime
                                clockOutSelfie = dummyBitmap
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)
                ) {
                    Text("Bypass Scan Wajah (Debug)")
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
    staffFaceDescriptor: FloatArray? = null,
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
    val context = LocalContext.current
    val faceRecognizer = remember { com.sukashawarma.superapp.utils.FaceRecognizer(context) }

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
                            val mediaImage = imageProxy.image
                            if (mediaImage != null) {
                                val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                val options = FaceDetectorOptions.Builder()
                                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                                    .build()
                                val detector = FaceDetection.getClient(options)
                                
                                detector.process(inputImage)
                                    .addOnSuccessListener { faces ->
                                        if (faces.size == 1) {
                                            faceDetected = true
                                            val face = faces[0]
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
                                                                    val embedding = faceRecognizer.extractEmbedding(bitmap)
                                                                    
                                                                    if (embedding.isNotEmpty()) {
                                                                        if (staffFaceDescriptor != null) {
                                                                            val similarity = FaceRecognizer.cosineSimilarity(embedding, staffFaceDescriptor)
                                                                            if (similarity >= 0.86f) {
                                                                                livenessState = LivenessState.STRAIGHT
                                                                                debugMessage = "Cocok! (Sim: $similarity)"
                                                                            } else {
                                                                                livenessState = LivenessState.INIT
                                                                                debugMessage = "Wajah Tidak Cocok! (Sim: $similarity)"
                                                                            }
                                                                        } else {
                                                                            // Jika belum terdaftar di DB (Mock)
                                                                            livenessState = LivenessState.STRAIGHT
                                                                            debugMessage = "Data DB Kosong (Bypass)"
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
                                                        livenessState = LivenessState.VERIFIED
                                                    }
                                                }
                                                else -> {}
                                            }
                                        } else {
                                            faceDetected = false
                                            debugMessage = if (faces.isEmpty()) "Tidak ada wajah" else "Terlalu banyak wajah"
                                        }
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            } else {
                                imageProxy.close()
                                debugMessage = "MediaImage Null"
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
