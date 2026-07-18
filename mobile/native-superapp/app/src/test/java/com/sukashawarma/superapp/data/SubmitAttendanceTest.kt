package com.sukashawarma.superapp.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import org.junit.Assert.*
import org.junit.Test

class SubmitAttendanceTest {

    @Test
    fun requestBodySerializeDenganNamaKolomServer() {
        val req = AttendanceSubmitRequest(
            id = "uuid-1", outletStaffId = "staff-1", outletId = "outlet-uuid",
            type = "in", tsClient = "2026-07-17T08:00:00Z",
            gpsLat = -6.6, gpsLng = 106.8, gpsAccuracy = 12.5
        )
        val json = Json.encodeToString(req)
        assertTrue(json.contains("\"outlet_staff_id\":\"staff-1\""))
        assertTrue(json.contains("\"outlet_id\":\"outlet-uuid\""))
        assertTrue(json.contains("\"ts_client\""))
        assertTrue(json.contains("\"gps_lat\""))
        // Nama kolom lama yang salah TIDAK boleh muncul
        assertFalse(json.contains("staffId"))
        assertFalse(json.contains("\"latitude\""))
        assertFalse(json.contains("\"photo_url\""))
    }

    @Test
    fun responseParseOkDanGagal() {
        val j = Json { ignoreUnknownKeys = true }
        val ok = j.decodeFromString<SubmitAttendanceResponse>("""{"ok":true,"status":"tepat","ts_server":"x","attendance_id":"y"}""")
        assertTrue(ok.ok); assertEquals("tepat", ok.status)
        val fail = j.decodeFromString<SubmitAttendanceResponse>("""{"ok":false,"reason":"too_early_in"}""")
        assertFalse(fail.ok); assertEquals("too_early_in", fail.reason)
    }

    @Test
    fun mappingReasonKePesanIndonesia() {
        assertTrue(SubmitFailureMessages.forReason("not_enrolled").contains("enrollment web"))
        assertTrue(SubmitFailureMessages.forReason("shift_not_closed").contains("Shift"))
        assertTrue(SubmitFailureMessages.forReason("too_far_from_outlet: Jarak 88m (Akurasi 10m)").contains("radius"))
        assertTrue(SubmitFailureMessages.forReason("kode_aneh").contains("kode_aneh"))
    }

    @Test
    fun mappingTooFarMenyertakanDetailJarakDariServer() {
        val pesan = SubmitFailureMessages.forReason("too_far_from_outlet: Jarak 88m (Akurasi 10m)")
        assertTrue(pesan.contains("88m"))
    }

    @Test
    fun attendanceServerExceptionBisaDibedakanDariExceptionBiasa() {
        // Respons server tak dikenali (HTML 502/maintenance) HARUS bisa ditangkap TERPISAH
        // dari kegagalan jaringan biasa — agar tidak salah masuk offline queue.
        val serverError: Exception = AttendanceServerException("Respons server tidak dikenali (HTTP 502): <html>")
        var caughtAsServerError = false
        try {
            throw serverError
        } catch (e: AttendanceServerException) {
            caughtAsServerError = true
            assertTrue(e.message!!.contains("HTTP 502"))
        } catch (e: Exception) {
            fail("Harus tertangkap sebagai AttendanceServerException, bukan Exception generik")
        }
        assertTrue(caughtAsServerError)

        // Exception jaringan biasa TIDAK boleh tertangkap sebagai AttendanceServerException
        val networkError: Exception = java.io.IOException("No network connection")
        var caughtAsGeneric = false
        try {
            throw networkError
        } catch (e: AttendanceServerException) {
            fail("IOException tidak boleh tertangkap sebagai AttendanceServerException")
        } catch (e: Exception) {
            caughtAsGeneric = true
        }
        assertTrue(caughtAsGeneric)
    }
}
