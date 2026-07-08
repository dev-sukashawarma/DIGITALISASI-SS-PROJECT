package com.sukashawarma.superapp.ui.features.enrollment

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
    
    var selectedStaff by remember { mutableStateOf<Staff?>(null) }
    var isReEnroll by remember { mutableStateOf(false) }
    var consentChecked by remember { mutableStateOf(false) }
    var reEnrollReason by remember { mutableStateOf("") }
    
    // Camera & ML State
    var debugMessage by remember { mutableStateOf("") }
    var faceRecognizer by remember { mutableStateOf<FaceRecognizer?>(null) }
    val capturedDescriptors = remember { mutableListOf<FloatArray>() }
    var photoBytes by remember { mutableStateOf<ByteArray?>(null) }

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
    
    val unenrolled = staffList.filter { it.enrolledAt == null }
    val enrolled = staffList.filter { it.enrolledAt != null }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pendaftaran Wajah Kru") },
                navigationIcon = {
                    IconButton(onClick = {
                        if (phase == EnrollPhase.LIST) onBack()
                        else {
                            phase = EnrollPhase.LIST
                            selectedStaff = null
                            capturedDescriptors.clear()
                            photoBytes = null
                        }
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize().background(Color(0xFFF8FAFC))) {
            when (phase) {
                EnrollPhase.LIST -> {
                    if (isLoadingList) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            if (unenrolled.isEmpty() && enrolled.isEmpty()) {
                                item {
                                    Text(
                                        "Tidak ada data kru.",
                                        modifier = Modifier.fillMaxWidth().padding(32.dp),
                                        textAlign = TextAlign.Center,
                                        color = Color.Gray
                                    )
                                }
                            }

                            if (unenrolled.isNotEmpty()) {
                                item {
                                    Text("Belum Terdaftar (${unenrolled.size})", color = Color(0xFFD97706), fontWeight = FontWeight.Bold)
                                }
                                items(unenrolled) { staff ->
                                    StaffCard(staff, isEnrolled = false) {
                                        selectedStaff = staff
                                        isReEnroll = false
                                        consentChecked = false
                                        phase = EnrollPhase.CONSENT
                                    }
                                }
                            }
                            
                            if (enrolled.isNotEmpty()) {
                                item {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("Sudah Terdaftar (${enrolled.size})", color = Color(0xFF10B981), fontWeight = FontWeight.Bold)
                                }
                                items(enrolled) { staff ->
                                    StaffCard(staff, isEnrolled = true) {
                                        selectedStaff = staff
                                        isReEnroll = true
                                        consentChecked = false
                                        reEnrollReason = ""
                                        phase = EnrollPhase.CONSENT
                                    }
                                }
                            }
                        }
                    }
                }
                EnrollPhase.CONSENT -> {
                    Column(
                        modifier = Modifier.padding(16.dp).fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(Modifier.padding(16.dp)) {
                                Text("Persetujuan Pendaftaran", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                Spacer(modifier = Modifier.height(16.dp))
                                Text("Kru Terpilih: ${selectedStaff?.name}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                Text("Role: ${selectedStaff?.role}")
                                
                                if (isReEnroll) {
                                    Spacer(modifier = Modifier.height(16.dp))
                                    Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(8.dp)) {
                                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFD97706))
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Peringatan: Data wajah sebelumnya akan dihapus dan diganti permanen.", fontSize = 12.sp, color = Color(0xFF92400E))
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    OutlinedTextField(
                                        value = reEnrollReason,
                                        onValueChange = { reEnrollReason = it },
                                        label = { Text("Alasan Enroll Ulang (Opsional)") },
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                                
                                Spacer(modifier = Modifier.height(24.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(checked = consentChecked, onCheckedChange = { consentChecked = it })
                                    Text("Saya, ${selectedStaff?.name}, setuju data wajah saya diproses secara digital.", fontSize = 14.sp)
                                }
                                
                                Spacer(modifier = Modifier.height(24.dp))
                                Button(
                                    onClick = {
                                        capturedDescriptors.clear()
                                        photoBytes = null
                                        phase = EnrollPhase.CENTER
                                    },
                                    enabled = consentChecked,
                                    modifier = Modifier.fillMaxWidth().height(50.dp)
                                ) {
                                    Text("Mulai Perekaman Kamera")
                                }
                            }
                        }
                    }
                }
                EnrollPhase.CENTER, EnrollPhase.LEFT, EnrollPhase.RIGHT -> {
                    Box(Modifier.fillMaxSize()) {
                        EnrollCameraPreview(
                            faceRecognizer = faceRecognizer,
                            currentPhase = phase,
                            onCapture = { descriptor, bitmap, nextPhase ->
                                capturedDescriptors.add(descriptor)
                                // Simpan gambar pertama sebagai referensi
                                if (photoBytes == null) {
                                    val stream = ByteArrayOutputStream()
                                    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)
                                    photoBytes = stream.toByteArray()
                                }
                                
                                if (nextPhase == EnrollPhase.SAVING) {
                                    phase = EnrollPhase.SAVING
                                    // Jalankan proses save
                                    coroutineScope.launch {
                                        try {
                                            val finalDesc = capturedDescriptors[0] // Hanya gunakan wajah depan untuk akurasi tertinggi
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
                                                adminStaff.id
                                            )
                                            phase = EnrollPhase.DONE
                                            // Update local list
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
                        
                        // Overlays
                        Column(
                            Modifier.align(Alignment.TopCenter).padding(top = 32.dp).background(Color.Black.copy(0.5f), RoundedCornerShape(16.dp)).padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = when (phase) {
                                    EnrollPhase.CENTER -> "Tatap Lurus ke Kamera"
                                    EnrollPhase.LEFT -> "Toleh Kiri Sedikit"
                                    EnrollPhase.RIGHT -> "Toleh Kanan Sedikit"
                                    else -> ""
                                },
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CircleProgress(active = phase == EnrollPhase.CENTER || phase == EnrollPhase.LEFT || phase == EnrollPhase.RIGHT, done = phase == EnrollPhase.LEFT || phase == EnrollPhase.RIGHT || phase == EnrollPhase.SAVING)
                                CircleProgress(active = phase == EnrollPhase.LEFT || phase == EnrollPhase.RIGHT, done = phase == EnrollPhase.RIGHT || phase == EnrollPhase.SAVING)
                                CircleProgress(active = phase == EnrollPhase.RIGHT, done = phase == EnrollPhase.SAVING)
                            }
                        }
                        
                        if (debugMessage.isNotEmpty()) {
                            Text(
                                text = debugMessage,
                                color = Color.Yellow,
                                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 32.dp).background(Color.Black.copy(0.6f)).padding(8.dp)
                            )
                        }
                    }
                }
                EnrollPhase.SAVING -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(16.dp))
                            Text("Menyimpan Data Wajah...")
                        }
                    }
                }
                EnrollPhase.DONE -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Card(Modifier.padding(32.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(64.dp))
                                Spacer(Modifier.height(16.dp))
                                Text("Pendaftaran Selesai!", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                                Spacer(Modifier.height(8.dp))
                                Text("Wajah ${selectedStaff?.name} berhasil didaftarkan.", textAlign = TextAlign.Center)
                                Spacer(Modifier.height(24.dp))
                                Button(
                                    onClick = { 
                                        phase = EnrollPhase.LIST 
                                        selectedStaff = null
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Kembali ke Daftar Kru")
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
fun CircleProgress(active: Boolean, done: Boolean) {
    Box(
        modifier = Modifier
            .size(16.dp)
            .background(
                color = if (done) Color(0xFF10B981) else if (active) Color(0xFF3B82F6) else Color.Gray,
                shape = CircleShape
            )
    )
}

@Composable
fun StaffCard(staff: Staff, isEnrolled: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(48.dp).background(if (isEnrolled) Color(0xFFD1FAE5) else Color(0xFFFEF3C7), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(staff.name.take(1).uppercase(), fontWeight = FontWeight.Bold, color = if (isEnrolled) Color(0xFF059669) else Color(0xFFD97706))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(staff.name, fontWeight = FontWeight.Bold)
                Text(staff.role, fontSize = 12.sp, color = Color.Gray)
            }
            if (isEnrolled) {
                Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(4.dp)) {
                    Text("Enroll Ulang", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 12.sp, color = Color(0xFFD97706), fontWeight = FontWeight.Bold)
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
                                            onErrorState("Wajah tidak terdeteksi")
                                            isProcessing = false
                                        } else if (faces.size > 1) {
                                            onErrorState("Hanya boleh 1 wajah dalam layar")
                                            isProcessing = false
                                        } else {
                                            val face = faces[0]
                                            val rotY = face.headEulerAngleY // Menoleh Kiri/Kanan
                                            
                                            // Cek arah wajah sesuai phase terbaru
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
                                                            onErrorState("Ruangan terlalu gelap")
                                                        } else {
                                                            // Face cropping WAJIB untuk FaceNet
                                                            // Harus SAMA PERSIS dengan AttendanceScreen
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
                                                // Beri delay sedikit agar UI update terasa sebelum lanjut
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

// Utils to convert ImageProxy to Bitmap
private fun imageProxyToBitmap(image: ImageProxy): Bitmap? {
    if (image.format != ImageFormat.YUV_420_888) return null
    val yBuffer = image.planes[0].buffer
    val uBuffer = image.planes[1].buffer
    val vBuffer = image.planes[2].buffer

    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()

    val nv21 = ByteArray(ySize + uSize + vSize)
    yBuffer.get(nv21, 0, ySize)
    vBuffer.get(nv21, ySize, vSize)
    uBuffer.get(nv21, ySize + vSize, uSize)

    val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
    val out = ByteArrayOutputStream()
    yuvImage.compressToJpeg(Rect(0, 0, yuvImage.width, yuvImage.height), 100, out)
    val imageBytes = out.toByteArray()
    
    // Harus di-rotate jika diperlukan, namun asumsi rotasi sederhana
    val bmp = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
    
    // Rotate untuk Front Camera Portrait Android
    val matrix = android.graphics.Matrix()
    matrix.postRotate(-90f) // Biasanya -90 derajat untuk kamera depan portrait
    return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
}
