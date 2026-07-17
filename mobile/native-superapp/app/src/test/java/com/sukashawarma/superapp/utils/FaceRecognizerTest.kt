package com.sukashawarma.superapp.utils

import org.junit.Assert.*
import org.junit.Test

class FaceRecognizerTest {

    @Test
    fun cosineSimilarity_vektorIdentik_mendekatiSatu() {
        val v = floatArrayOf(0.6f, 0.8f)
        assertEquals(1f, FaceRecognizer.cosineSimilarity(v, v), 0.001f)
    }

    @Test
    fun cosineSimilarity_bedaDimensi_kembalikanMinusSatu() {
        // Guard: descriptor DB lama (mis. 192d model lama) vs embedding model baru (mis. 512d)
        // tidak boleh crash / diam-diam salah — harus gagal eksplisit.
        val a = floatArrayOf(0.1f, 0.2f, 0.3f)
        val b = floatArrayOf(0.1f, 0.2f)
        assertEquals(-1f, FaceRecognizer.cosineSimilarity(a, b), 0.0f)
        assertEquals(-1f, FaceRecognizer.cosineSimilarity(b, a), 0.0f)
    }

    @Test
    fun cosineSimilarity_vektorKosong_kembalikanMinusSatu() {
        assertEquals(-1f, FaceRecognizer.cosineSimilarity(FloatArray(0), FloatArray(0)), 0.0f)
    }

    @Test
    fun thresholdTunggal_adaDanMasukAkal() {
        // Satu konstanta untuk SEMUA jalur verifikasi (ganti 0.85/0.80 inline yang dulu beda-beda)
        assertTrue(FaceRecognizer.MOBILE_MATCH_THRESHOLD in 0.5f..0.95f)
    }

    @Test
    fun cosineSimilarity_vektorOrtogonal_nol() {
        val a = floatArrayOf(1f, 0f)
        val b = floatArrayOf(0f, 1f)
        assertEquals(0f, FaceRecognizer.cosineSimilarity(a, b), 0.001f)
    }

    @Test
    fun cosineSimilarity_vektorNol_kembalikanNol() {
        val zero = floatArrayOf(0f, 0f)
        val v = floatArrayOf(1f, 0f)
        assertEquals(0f, FaceRecognizer.cosineSimilarity(zero, v), 0.0f)
    }
}
