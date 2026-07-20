package com.sukashawarma.superapp.utils

import android.content.Context
import android.graphics.Bitmap
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import kotlin.math.sqrt

class FaceRecognizer(context: Context) {
    private var interpreter: Interpreter? = null
    private var inputImageSize = 112
    private var outputSize = 192
    
    var isModelLoaded: Boolean = false
        private set
        
    var loadError: String = ""
        private set

    init {
        try {
            val assetManager = context.assets
            val fileDescriptor = assetManager.openFd("facenet.tflite")
            val inputStream = FileInputStream(fileDescriptor.fileDescriptor)
            val fileChannel = inputStream.channel
            val startOffset = fileDescriptor.startOffset
            val declaredLength = fileDescriptor.declaredLength
            val modelBuffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
            
            interpreter = Interpreter(modelBuffer)
            
            // Baca shape secara dinamis agar anti-crash apapun modelnya
            interpreter?.let { interp ->
                val inputShape = interp.getInputTensor(0).shape()
                if (inputShape.size >= 3) {
                    inputImageSize = inputShape[1] // Biasanya [1, 112, 112, 3] atau [1, 160, 160, 3]
                }
                
                val outputShape = interp.getOutputTensor(0).shape()
                if (outputShape.size >= 2) {
                    outputSize = outputShape[1] // Biasanya [1, 192] atau [1, 512]
                }
                
                isModelLoaded = true
            }
            
        } catch (e: Exception) {
            e.printStackTrace()
            isModelLoaded = false
            loadError = e.message ?: "Unknown Error"
            // Jika model gagal dimuat, isModelLoaded=false → extractEmbedding gagal eksplisit (FloatArray kosong)
        }
    }

    fun extractEmbedding(bitmap: Bitmap): FloatArray {
        // Model tidak ter-load = kegagalan nyata. FloatArray kosong → semua jalur pemanggil
        // (cek embedding.isNotEmpty() + guard cosineSimilarity) gagal eksplisit. TIDAK ADA mock.
        val interp = interpreter ?: return FloatArray(0)

        val resizedBitmap = Bitmap.createScaledBitmap(bitmap, inputImageSize, inputImageSize, false)
        val byteBuffer = convertBitmapToByteBuffer(resizedBitmap)
        
        val output = Array(1) { FloatArray(outputSize) }
        interp.run(byteBuffer, output)
        
        // L2 Normalization
        val embedding = output[0]
        var sumSquares = 0f
        for (value in embedding) {
            sumSquares += value * value
        }
        val l2Norm = sqrt(sumSquares.toDouble()).toFloat()
        if (l2Norm > 0) {
            for (i in embedding.indices) {
                embedding[i] = embedding[i] / l2Norm
            }
        }
        
        return embedding
    }

    fun isImageTooDark(bitmap: Bitmap, threshold: Float = 50f): Boolean {
        // Pengecekan kualitas gambar: Brightness Check sederhana
        val scaled = Bitmap.createScaledBitmap(bitmap, 50, 50, false)
        val pixels = IntArray(2500)
        scaled.getPixels(pixels, 0, 50, 0, 0, 50, 50)
        var totalLuminance = 0f
        for (pixel in pixels) {
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            val luminance = 0.299f * r + 0.587f * g + 0.114f * b
            totalLuminance += luminance
        }
        val averageLuminance = totalLuminance / 2500f
        return averageLuminance < threshold
    }

    private fun convertBitmapToByteBuffer(bitmap: Bitmap): ByteBuffer {
        val byteBuffer = ByteBuffer.allocateDirect(1 * inputImageSize * inputImageSize * 3 * 4)
        byteBuffer.order(ByteOrder.nativeOrder())
        
        val intValues = IntArray(inputImageSize * inputImageSize)
        bitmap.getPixels(intValues, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        
        var pixel = 0
        for (i in 0 until inputImageSize) {
            for (j in 0 until inputImageSize) {
                val value = intValues[pixel++]
                
                // Normalization dari [0, 255] ke [-1, 1]
                byteBuffer.putFloat(((value shr 16 and 0xFF) - 127.5f) / 127.5f) // Red
                byteBuffer.putFloat(((value shr 8 and 0xFF) - 127.5f) / 127.5f)  // Green
                byteBuffer.putFloat(((value and 0xFF) - 127.5f) / 127.5f)        // Blue
            }
        }
        return byteBuffer
    }

    companion object {
        /**
         * Threshold cosine similarity verifikasi 1:1.
         * Kalibrasi 2026-07-20 (4 sample): min same-person=0.6837, max different-person=0.5411
         * Threshold final=0.65 (safety margin 0.034 dari min same-person, gap 0.11 dari max different-person).
         */
        const val MOBILE_MATCH_THRESHOLD = 0.65f

        fun cosineSimilarity(vectorA: FloatArray, vectorB: FloatArray): Float {
            // Guard dimensi: descriptor lama/korup vs model baru → gagal eksplisit, bukan crash
            if (vectorA.isEmpty() || vectorA.size != vectorB.size) return -1f
            var dotProduct = 0.0
            var normA = 0.0
            var normB = 0.0
            for (i in vectorA.indices) {
                dotProduct += vectorA[i] * vectorB[i]
                normA += vectorA[i] * vectorA[i]
                normB += vectorB[i] * vectorB[i]
            }
            if (normA == 0.0 || normB == 0.0) return 0f
            return (dotProduct / (sqrt(normA) * sqrt(normB))).toFloat()
        }

        fun averageDescriptors(descriptors: List<FloatArray>): FloatArray {
            if (descriptors.isEmpty()) return FloatArray(0)
            val size = descriptors[0].size
            val sum = FloatArray(size)
            for (desc in descriptors) {
                for (i in 0 until size) {
                    sum[i] += desc[i]
                }
            }
            val avg = FloatArray(size)
            var sumSquares = 0f
            for (i in 0 until size) {
                val value = sum[i] / descriptors.size
                avg[i] = value
                sumSquares += value * value
            }
            val l2Norm = sqrt(sumSquares.toDouble()).toFloat()
            if (l2Norm > 0) {
                for (i in 0 until size) {
                    avg[i] /= l2Norm
                }
            }
            return avg
        }
    }
}
