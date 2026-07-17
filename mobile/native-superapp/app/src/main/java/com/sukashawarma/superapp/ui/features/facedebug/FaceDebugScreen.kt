package com.sukashawarma.superapp.ui.features.facedebug

import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.sukashawarma.superapp.ui.components.CameraPreview
import com.sukashawarma.superapp.utils.FaceRecognizer

/**
 * Alat kalibrasi internal (role ENROLLMENT): capture 2 embedding (A/B) → lihat cosine similarity.
 * Prosedur: A & B orang yang SAMA (ulangi 3 orang) → catat skor min; lalu A=orang X, B=orang Y
 * (3 pasang) → catat skor max. Threshold = titik tengah dua kelompok skor (pola kalibrasi web).
 */
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable
fun FaceDebugScreen(onBackClick: () -> Unit) {
    val context = LocalContext.current
    val faceRecognizer = remember { FaceRecognizer(context) }
    val detector = remember {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .build()
        )
    }
    var slotA by remember { mutableStateOf<FloatArray?>(null) }
    var slotB by remember { mutableStateOf<FloatArray?>(null) }
    var captureTarget by remember { mutableStateOf<Char?>(null) }
    var status by remember { mutableStateOf(if (faceRecognizer.isModelLoaded) "Model OK" else "MODEL GAGAL: ${faceRecognizer.loadError}") }

    val similarity = if (slotA != null && slotB != null)
        FaceRecognizer.cosineSimilarity(slotA!!, slotB!!) else null

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {
            CameraPreview(
                onFaceDetected = {},
                onImageCaptureReady = { imageProxy ->
                    val target = captureTarget
                    val mediaImage = imageProxy.image
                    if (target == null || mediaImage == null) {
                        imageProxy.close()
                        return@CameraPreview
                    }
                    val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                    detector.process(inputImage)
                        .addOnSuccessListener { faces ->
                            val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
                            val bitmap = try { imageProxy.toBitmap() } catch (e: Exception) { null }
                            if (face != null && bitmap != null) {
                                val b = face.boundingBox
                                val left = b.left.coerceIn(0, bitmap.width - 1)
                                val top = b.top.coerceIn(0, bitmap.height - 1)
                                val right = b.right.coerceIn(left + 1, bitmap.width)
                                val bottom = b.bottom.coerceIn(top + 1, bitmap.height)
                                val faceBitmap = Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top)
                                val emb = faceRecognizer.extractEmbedding(faceBitmap)
                                if (emb.isNotEmpty()) {
                                    if (target == 'A') slotA = emb else slotB = emb
                                    captureTarget = null
                                    status = "Slot $target terisi (${emb.size}d)"
                                } else {
                                    status = "Gagal ekstrak embedding"
                                }
                            } else {
                                status = "Tidak ada wajah terdeteksi — coba lagi"
                            }
                        }
                        .addOnFailureListener { status = "Deteksi gagal: ${it.message}" }
                        .addOnCompleteListener { imageProxy.close() }
                }
            )
        }
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(status, fontSize = 13.sp)
            Text(
                "A: ${slotA?.size?.let { "${it}d" } ?: "-"}  |  B: ${slotB?.size?.let { "${it}d" } ?: "-"}  |  Sim: ${similarity?.let { String.format("%.4f", it) } ?: "-"}",
                fontSize = 16.sp
            )
            Text("Threshold aktif: ${FaceRecognizer.MOBILE_MATCH_THRESHOLD}", fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { captureTarget = 'A' }, enabled = faceRecognizer.isModelLoaded) { Text("Capture A") }
                Button(onClick = { captureTarget = 'B' }, enabled = faceRecognizer.isModelLoaded) { Text("Capture B") }
                OutlinedButton(onClick = onBackClick) { Text("Tutup") }
            }
        }
    }
}
