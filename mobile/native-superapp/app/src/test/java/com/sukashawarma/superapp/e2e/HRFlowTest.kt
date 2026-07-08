package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.Attendance
import com.sukashawarma.superapp.data.Outlet
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.domain.HRService
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.Calendar
import java.util.Date

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class HRFlowTest {

    private lateinit var client: SupabaseClient
    private val outlet = Outlet("outlet_sudirman", "Sudirman Branch", -6.2198, 106.8162, 100.0) // Lat/Lon in Jakarta

    @Before
    fun setUp() {
        client = SupabaseClient()
    }

    private fun createTime(hour: Int, minute: Int): Date {
        return Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.time
    }

    // --- TIER 1: Feature Coverage (5 tests) ---

    @Test
    fun testTier1_HaversineDistanceCalculation() {
        // Distance between Outlet Sudirman and a point ~50m away
        // Outlet: -6.2198, 106.8162
        // Device: -6.2201, 106.8165
        val dist = HRService.calculateDistanceInMeters(-6.2198, 106.8162, -6.2201, 106.8165)
        assertTrue(dist > 30.0 && dist < 70.0)
    }

    @Test
    fun testTier1_GeofenceCheckWithinRadius() {
        // Device is within 100m radius
        val isInside = HRService.verifyGeofence(
            deviceLat = -6.21985, deviceLon = 106.81625, accuracy = 5.0,
            outletLat = outlet.latitude, outletLon = outlet.longitude, radius = outlet.radiusMeter
        )
        assertTrue(isInside)
    }

    @Test
    fun testTier1_GeofenceCheckOutsideRadius() {
        // Device is clearly outside 100m (distance is ~500m)
        val isInside = HRService.verifyGeofence(
            deviceLat = -6.2248, deviceLon = 106.8192, accuracy = 5.0,
            outletLat = outlet.latitude, outletLon = outlet.longitude, radius = outlet.radiusMeter
        )
        assertFalse(isInside)
    }

    @Test
    fun testTier1_ClockInStatusOnTime() {
        val clockInTime = createTime(8, 10) // 08:10 (tolerance is 15 mins)
        val status = HRService.determineAttendanceStatus(clockInTime, "CLOCK_IN")
        assertEquals("ON_TIME", status)
    }

    @Test
    fun testTier1_ClockInStatusLate() {
        val clockInTime = createTime(8, 20) // 08:20 (tolerance is 15 mins)
        val status = HRService.determineAttendanceStatus(clockInTime, "CLOCK_IN")
        assertEquals("LATE", status)
    }

    // --- TIER 2: Boundary / Corner Cases (3 tests) ---

    @Test
    fun testTier2_GeofenceWithAccuracyBuffer() {
        // Device distance is 115m (technically outside 100m radius).
        // However, device accuracy is 20m.
        // Effective distance: 115m - 20m = 95m <= 100m. So it should PASS.
        val distance = HRService.calculateDistanceInMeters(-6.2198, 106.8162, -6.2208, 106.8164)
        assertTrue(distance > 100.0 && distance < 130.0)

        val isInside = HRService.verifyGeofence(
            deviceLat = -6.2208, deviceLon = 106.8164, accuracy = 20.0,
            outletLat = outlet.latitude, outletLon = outlet.longitude, radius = outlet.radiusMeter
        )
        assertTrue(isInside)
    }

    @Test
    fun testTier2_ClockInExactlyAtToleranceBoundary() {
        val clockInTime = createTime(8, 15) // exactly 08:15
        val status = HRService.determineAttendanceStatus(clockInTime, "CLOCK_IN")
        assertEquals("ON_TIME", status)
    }

    @Test
    fun testTier2_ClockOutEarlyStatus() {
        val clockOutTime = createTime(16, 40) // shift ends 17:00, tolerance 15m (16:45 is boundary)
        val status = HRService.determineAttendanceStatus(clockOutTime, "CLOCK_OUT")
        assertEquals("EARLY_OUT", status)
    }

    // --- TIER 3: Cross-Feature Combinations (2 tests) ---

    @Test
    fun testTier3_OfflineQueuePersistence() {
        var actionExecuted = false
        client.queueOfflineAction {
            actionExecuted = true
        }
        assertEquals(1, client.getOfflineQueueSize())
        assertFalse(actionExecuted)
    }

    @Test
    fun testTier3_OfflineQueueAutoSyncOnConnectionRecovery() = runBlocking {
        client.setOffline(true)
        var actionExecuted = false
        client.queueOfflineAction {
            actionExecuted = true
        }

        // Action not run yet
        assertFalse(actionExecuted)

        // Device goes online and triggers sync
        client.setOffline(false)
        client.syncOfflineQueue()

        assertTrue(actionExecuted)
        assertEquals(0, client.getOfflineQueueSize())
    }

    // --- TIER 4: Real-World Workload (1 test) ---

    @Test
    fun testTier4_GeofencedOfflineShiftWorkload() = runBlocking {
        client.setOffline(true)
        val syncedAttendances = mutableListOf<Attendance>()

        // 1. Employee is at the outlet but app is offline. They clock in.
        // We verify geofence locally first
        val isGeofenceOk = HRService.verifyGeofence(
            deviceLat = -6.21985, deviceLon = 106.81625, accuracy = 10.0,
            outletLat = outlet.latitude, outletLon = outlet.longitude, radius = outlet.radiusMeter
        )
        assertTrue(isGeofenceOk)

        val clockInTime = createTime(8, 5) // 08:05 -> ON_TIME
        val status = HRService.determineAttendanceStatus(clockInTime, "CLOCK_IN")

        val attendanceRecord = Attendance(
            id = "att_1",
            staffId = "staff_joe",
            outletId = outlet.id,
            timestamp = clockInTime,
            type = "CLOCK_IN",
            latitude = -6.21985,
            longitude = 106.81625,
            accuracy = 10.0,
            status = status,
            isOffline = true
        )

        // 2. Queue sync operation
        client.queueOfflineAction {
            // Simulate API push
            syncedAttendances.add(attendanceRecord.copy(isOffline = false))
        }

        assertEquals(1, client.getOfflineQueueSize())
        assertTrue(syncedAttendances.isEmpty())

        // 3. Network recovers, auto-sync triggers
        client.setOffline(false)
        client.syncOfflineQueue()

        assertEquals(0, client.getOfflineQueueSize())
        assertEquals(1, syncedAttendances.size)
        val record = syncedAttendances[0]
        assertEquals("att_1", record.id)
        assertFalse(record.isOffline)
        assertEquals("ON_TIME", record.status)
    }
}
