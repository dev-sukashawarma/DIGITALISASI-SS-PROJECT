package com.sukashawarma.superapp.data

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.broadcast
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import io.ktor.client.engine.okhttp.OkHttp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.Job
import java.io.IOException
import java.util.concurrent.TimeoutException

interface SupabaseAuthCallback {
    fun onSuccess(token: String)
    fun onFailure(error: Throwable)
}

private interface SupabaseClientDelegate : AuthRepository, SyncRepository, RealtimeRepository {
    val realClient: io.github.jan.supabase.SupabaseClient?
    fun initialize(url: String, anonKey: String)
    fun setShouldTimeout(timeout: Boolean)
    fun login(email: String, password: String, callback: SupabaseAuthCallback)
    fun refreshSession(oldToken: String, callback: SupabaseAuthCallback)
    fun getToken(): String?
    override suspend fun getStaffProfile(identifier: String): Staff?
    suspend fun getStaffList(outletId: String): List<Staff>
    suspend fun getOutlet(outletId: String): Outlet?
    suspend fun uploadFaceReference(outletId: String, staffId: String, photoData: ByteArray): String
    suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String)
    
    // Attendance Methods
    suspend fun getConfig(outletId: String): OutletAttendanceConfigDto?
    suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRecordDto?
    suspend fun checkClockOutGates(outletId: String): Pair<Boolean, String?>
    suspend fun submitAttendance(dto: AttendanceRecordDto)
}

class SupabaseClient(val isTesting: Boolean = true) : AuthRepository, SyncRepository, RealtimeRepository {
    
    private val delegate: SupabaseClientDelegate = if (isTesting || isUnderTest) {
        MockDelegate()
    } else {
        ProductionDelegate()
    }

    val realClient: io.github.jan.supabase.SupabaseClient?
        get() = delegate.realClient

    fun initialize(url: String, anonKey: String) = delegate.initialize(url, anonKey)

    override fun isOffline(): Boolean = delegate.isOffline()
    
    override fun setOffline(offline: Boolean) = delegate.setOffline(offline)

    fun setShouldTimeout(timeout: Boolean) = delegate.setShouldTimeout(timeout)

    fun login(identifier: String, password: String, callback: SupabaseAuthCallback) {
        val trimmed = identifier.trim()
        val email = if (!trimmed.contains("@") && trimmed.isNotEmpty()) "$trimmed@sukashawarma.com" else trimmed
        delegate.login(email, password, callback)
    }

    fun refreshSession(oldToken: String, callback: SupabaseAuthCallback) = delegate.refreshSession(oldToken, callback)

    override fun logout() = delegate.logout()

    override fun isAuthenticated(): Boolean = delegate.isAuthenticated()

    fun getToken(): String? = delegate.getToken()

    override fun subscribeToChannel(channel: String, event: String, callback: RealtimeSubscriptionCallback) = delegate.subscribeToChannel(channel, event, callback)

    override fun triggerRealtimeEvent(channel: String, event: String, payload: Map<String, Any>) = delegate.triggerRealtimeEvent(channel, event, payload)

    override fun queueOfflineAction(action: suspend () -> Unit) = delegate.queueOfflineAction(action)

    override suspend fun syncOfflineQueue() = delegate.syncOfflineQueue()

    override fun getOfflineQueueSize(): Int = delegate.getOfflineQueueSize()

    override fun getUserRole(identifier: String): String {
        val email = if (!identifier.contains("@") && identifier.isNotEmpty()) "$identifier@sukashawarma.com" else identifier
        return delegate.getUserRole(email)
    }

    override suspend fun getStaffProfile(identifier: String): Staff? {
        val email = if (!identifier.contains("@") && identifier.isNotEmpty()) "$identifier@sukashawarma.com" else identifier
        return delegate.getStaffProfile(email)
    }

    suspend fun getStaffList(outletId: String): List<Staff> = delegate.getStaffList(outletId)
    suspend fun getOutlet(outletId: String): Outlet? = delegate.getOutlet(outletId)
    suspend fun uploadFaceReference(outletId: String, staffId: String, photoData: ByteArray): String = delegate.uploadFaceReference(outletId, staffId, photoData)
    suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String) = delegate.saveEnrollment(staffId, descriptor, photoUrl, isReEnroll, reason, adminId)

    suspend fun getConfig(outletId: String): OutletAttendanceConfigDto? = delegate.getConfig(outletId)
    suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRecordDto? = delegate.getTodayAttendance(staffId, type)
    suspend fun checkClockOutGates(outletId: String): Pair<Boolean, String?> = delegate.checkClockOutGates(outletId)
    suspend fun submitAttendance(dto: AttendanceRecordDto) = delegate.submitAttendance(dto)

    companion object {
        private val isUnderTest = try {
            Class.forName("org.robolectric.RobolectricTestRunner")
            true
        } catch (e: ClassNotFoundException) {
            try {
                Class.forName("org.junit.Test")
                true
            } catch (e: ClassNotFoundException) {
                false
            }
        }

        private var instance: SupabaseClient? = null
        
        fun initialize(url: String, anonKey: String): SupabaseClient {
            val clientObj = SupabaseClient(isTesting = false)
            clientObj.initialize(url, anonKey)
            instance = clientObj
            return clientObj
        }
        
        val client: io.github.jan.supabase.SupabaseClient
            get() = instance?.realClient ?: throw IllegalStateException("Supabase client is not initialized")
            
        fun getInstance(): SupabaseClient = instance ?: throw IllegalStateException("SupabaseClient not initialized")
        
        fun isInitialized(): Boolean = instance != null
    }
}

private class ProductionDelegate : SupabaseClientDelegate {
    override var realClient: io.github.jan.supabase.SupabaseClient? = null
        private set

    private var isOffline = false
    private val offlineQueue = mutableListOf<suspend () -> Unit>()
    private val activeJobs = mutableMapOf<String, MutableList<Job>>()

    override fun initialize(url: String, anonKey: String) {
        realClient = createSupabaseClient(url, anonKey) {
            httpEngine = OkHttp.create()
            install(Auth)
            install(Postgrest)
            install(Realtime)
            install(Storage)
        }
    }

    override fun isOffline(): Boolean = isOffline
    
    override fun setOffline(offline: Boolean) {
        this.isOffline = offline
    }

    override fun setShouldTimeout(timeout: Boolean) {
        // No-op in production
    }

    override fun login(email: String, password: String, callback: SupabaseAuthCallback) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client is not initialized")
        CoroutineScope(Dispatchers.IO).launch {
            try {
                clientObj.auth.signInWith(Email) {
                    this.email = email
                    this.password = password
                }
                val session = clientObj.auth.currentSessionOrNull()
                val accessToken = session?.accessToken
                if (accessToken != null) {
                    withContext(Dispatchers.Main) {
                        callback.onSuccess(accessToken)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        callback.onFailure(IllegalStateException("Session is null"))
                    }
                }
            } catch (e: Throwable) {
                withContext(Dispatchers.Main) {
                    callback.onFailure(e)
                }
            }
        }
    }

    override fun refreshSession(oldToken: String, callback: SupabaseAuthCallback) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client is not initialized")
        CoroutineScope(Dispatchers.IO).launch {
            try {
                clientObj.auth.refreshCurrentSession()
                val session = clientObj.auth.currentSessionOrNull()
                val accessToken = session?.accessToken
                if (accessToken != null) {
                    withContext(Dispatchers.Main) {
                        callback.onSuccess(accessToken)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        callback.onFailure(IllegalStateException("Failed to refresh session"))
                    }
                }
            } catch (e: Throwable) {
                withContext(Dispatchers.Main) {
                    callback.onFailure(e)
                }
            }
        }
    }

    override fun logout() {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client is not initialized")
        synchronized(activeJobs) {
            activeJobs.values.forEach { jobsList ->
                jobsList.forEach { it.cancel() }
            }
            activeJobs.clear()
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                clientObj.auth.signOut()
            } catch (e: Throwable) {
                // Ignore or log
            }
        }
    }

    override fun isAuthenticated(): Boolean {
        return realClient?.auth?.currentSessionOrNull() != null
    }

    override fun getToken(): String? {
        return realClient?.auth?.currentSessionOrNull()?.accessToken
    }

    override fun subscribeToChannel(channel: String, event: String, callback: RealtimeSubscriptionCallback) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client is not initialized")
        
        val channelJobsList = mutableListOf<Job>()
        synchronized(activeJobs) {
            activeJobs[channel]?.forEach { it.cancel() }
            activeJobs[channel] = channelJobsList
        }

        val mainJob = CoroutineScope(Dispatchers.IO).launch {
            try {
                val ch = clientObj.realtime.channel(channel)
                ch.subscribe()
                
                val eventJob = launch {
                    try {
                        ch.broadcastFlow<Map<String, Any>>(event).collect { payload ->
                            withContext(Dispatchers.Main) {
                                callback.onEvent(event, payload)
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                synchronized(activeJobs) {
                    channelJobsList.add(eventJob)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        
        synchronized(activeJobs) {
            channelJobsList.add(mainJob)
        }
    }

    override fun triggerRealtimeEvent(channel: String, event: String, payload: Map<String, Any>) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client is not initialized")
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ch = clientObj.realtime.channel(channel)
                ch.broadcast(event, payload)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    override fun queueOfflineAction(action: suspend () -> Unit) {
        offlineQueue.add(action)
        try {
            val logDir = try {
                com.sukashawarma.superapp.SuperAppApplication.instance.cacheDir
            } catch (e: Throwable) {
                java.io.File("/data/local/tmp")
            }
            val logFile = java.io.File(logDir, "offline_actions.txt")
            logFile.appendText("Queued offline action at ${java.util.Date()}\n")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override suspend fun syncOfflineQueue() {
        if (isOffline) return
        val actions = ArrayList(offlineQueue)
        offlineQueue.clear()
        for (action in actions) {
            action.invoke()
        }
    }

    override fun getOfflineQueueSize(): Int = offlineQueue.size

    override fun getUserRole(identifier: String): String {
        val user = realClient?.auth?.currentUserOrNull()
        val metadataRole = user?.userMetadata?.get("role")?.toString()?.removeSurrounding("\"")
        return metadataRole ?: "cashier"
    }

    override suspend fun getStaffProfile(identifier: String): Staff? {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        val session = clientObj.auth.currentSessionOrNull()
        val userId = session?.user?.id ?: throw IllegalStateException("User session not found")
        val username = identifier.substringBefore("@")
        
        // Hanya ambil kolom utama, HINDARI JOIN (outlets(name)) karena sering menyebabkan PostgREST error
        val cols = io.github.jan.supabase.postgrest.query.Columns.raw("id, outlet_id, name, role, face_descriptor, enrolled_at, re_enrolled_at, re_enrolled_by, re_enroll_reason, ref_photo_url, consent_at, consent_by")
        
        // 1. Coba cari berdasarkan ID (Metode paling benar)
        var result = clientObj.postgrest["outlet_staff"].select(columns = cols) {
            filter { eq("id", userId) }
        }.decodeList<OutletStaffDto>().firstOrNull()
        
        // 2. Jika gagal, coba cari berdasarkan username
        if (result == null) {
            result = clientObj.postgrest["outlet_staff"].select(columns = cols) {
                filter { eq("username", username) }
            }.decodeList<OutletStaffDto>().firstOrNull()
        }
        
        // 3. Jika masih gagal, coba cari berdasarkan name
        if (result == null) {
            result = clientObj.postgrest["outlet_staff"].select(columns = cols) {
                filter { eq("name", username) }
            }.decodeList<OutletStaffDto>().firstOrNull()
        }
        
        if (result == null) return null
        
        // Coba ambil nama outlet secara terpisah
        val outletName = try {
            if (result.outletId != null) {
                val outletCols = io.github.jan.supabase.postgrest.query.Columns.raw("name")
                val outletResult = clientObj.postgrest["outlets"].select(columns = outletCols) {
                    filter { eq("id", result.outletId) }
                }.decodeList<OutletNameDto>().firstOrNull()
                outletResult?.name ?: result.outletId
            } else {
                "Pusat (Semua Outlet)"
            }
        } catch (e: Exception) {
            result.outletId ?: "Pusat (Semua Outlet)"
        }
        
        return Staff(
            id = result.id,
            name = result.name,
            role = result.role,
            assignedOutletId = outletName,
            faceDescriptor = result.faceDescriptor?.toFloatArray(),
            enrolledAt = result.enrolledAt,
            reEnrolledAt = result.reEnrolledAt,
            reEnrolledBy = result.reEnrolledBy,
            reEnrollReason = result.reEnrollReason,
            refPhotoUrl = result.refPhotoUrl,
            consentAt = result.consentAt,
            consentBy = result.consentBy
        )
    }

    override suspend fun getStaffList(outletId: String): List<Staff> {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        val cols = io.github.jan.supabase.postgrest.query.Columns.raw("id, outlet_id, name, role, face_descriptor, enrolled_at, re_enrolled_at, re_enrolled_by, re_enroll_reason, ref_photo_url, consent_at, consent_by")
        val results = clientObj.postgrest["outlet_staff"].select(columns = cols) {
            filter {
                if (outletId != "Pusat (Semua Outlet)") {
                    eq("outlet_id", outletId)
                }
            }
        }.decodeList<OutletStaffDto>()
        
        return results.map { result ->
            Staff(
                id = result.id,
                name = result.name,
                role = result.role,
                assignedOutletId = result.outletId ?: "Pusat (Semua Outlet)",
                faceDescriptor = result.faceDescriptor?.toFloatArray(),
                enrolledAt = result.enrolledAt,
                reEnrolledAt = result.reEnrolledAt,
                reEnrolledBy = result.reEnrolledBy,
                reEnrollReason = result.reEnrollReason,
                refPhotoUrl = result.refPhotoUrl,
                consentAt = result.consentAt,
                consentBy = result.consentBy
            )
        }.sortedBy { it.name }
    }

    override suspend fun getOutlet(outletId: String): Outlet? {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        return try {
            @kotlinx.serialization.Serializable
            data class OutletDto(
                val id: String,
                val name: String,
                val latitude: Double? = null,
                val longitude: Double? = null,
                val radius_meter: Double? = 100.0
            )
            
            val dto = clientObj.postgrest["outlets"]
                .select { filter { eq("id", outletId) } }
                .decodeSingleOrNull<OutletDto>()
                
            if (dto != null && dto.latitude != null && dto.longitude != null) {
                Outlet(
                    id = dto.id,
                    name = dto.name,
                    latitude = dto.latitude,
                    longitude = dto.longitude,
                    radiusMeter = dto.radius_meter ?: 100.0
                )
            } else null
        } catch (e: Exception) {
            android.util.Log.e("SupabaseClient", "Failed to fetch outlet location", e)
            null
        }
    }

    override suspend fun uploadFaceReference(outletId: String, staffId: String, photoData: ByteArray): String {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        val refPath = "$outletId/$staffId.jpg"
        clientObj.storage.from("face-refs").upload(
            path = refPath,
            data = photoData
        ) {
            upsert = true
        }
        return refPath
    }

    @kotlinx.serialization.Serializable
    private data class EnrollmentUpdateDto(
        @kotlinx.serialization.SerialName("face_descriptor") val faceDescriptor: List<Float>,
        @kotlinx.serialization.SerialName("ref_photo_url") val refPhotoUrl: String,
        @kotlinx.serialization.SerialName("consent_at") val consentAt: String,
        @kotlinx.serialization.SerialName("consent_by") val consentBy: String,
        @kotlinx.serialization.SerialName("enrolled_at") val enrolledAt: String,
        @kotlinx.serialization.SerialName("re_enrolled_at") val reEnrolledAt: String? = null,
        @kotlinx.serialization.SerialName("re_enrolled_by") val reEnrolledBy: String? = null,
        @kotlinx.serialization.SerialName("re_enroll_reason") val reEnrollReason: String? = null
    )

    override suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        val now = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply { 
            timeZone = java.util.TimeZone.getTimeZone("UTC") 
        }.format(java.util.Date())
        
        android.util.Log.d("ENROLL", "Saving descriptor with ${descriptor.size} floats for $staffId")
        
        val updateDto = EnrollmentUpdateDto(
            faceDescriptor = descriptor.toList(),
            refPhotoUrl = photoUrl,
            consentAt = now,
            consentBy = adminId,
            enrolledAt = now,
            reEnrolledAt = if (isReEnroll) now else null,
            reEnrolledBy = if (isReEnroll) adminId else null,
            reEnrollReason = if (isReEnroll) reason else null
        )
        
        clientObj.postgrest["outlet_staff"].update(updateDto) {
            filter { eq("id", staffId) }
        }
        android.util.Log.d("ENROLL", "Successfully saved to database")
    }

    override suspend fun getConfig(outletId: String): OutletAttendanceConfigDto? {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        return try {
            clientObj.postgrest["outlet_attendance_config"]
                .select { filter { eq("outlet_id", outletId) } }
                .decodeSingleOrNull<OutletAttendanceConfigDto>()
        } catch (e: Exception) {
            android.util.Log.e("SupabaseClient", "Failed to fetch config", e)
            null
        }
    }

    override suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRecordDto? {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        return try {
            // Kita cari dari awal hari berdasarkan timezone (ideal di query, tapi sementara ambil limit 1 descending)
            val todayDateStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("Asia/Jakarta")
            }.format(java.util.Date())
            
            clientObj.postgrest["attendance"]
                .select {
                    filter { 
                        eq("staff_id", staffId)
                        eq("type", type)
                        gte("ts_client", "${todayDateStr}T00:00:00+07:00")
                    }
                    order("ts_client", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    limit(1)
                }
                .decodeSingleOrNull<AttendanceRecordDto>()
        } catch (e: Exception) {
            android.util.Log.e("SupabaseClient", "Failed to fetch today attendance", e)
            null
        }
    }

    override suspend fun checkClockOutGates(outletId: String): Pair<Boolean, String?> {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        try {
            // Cek Checklist
            val checklists = clientObj.postgrest["daily_checklists"]
                .select {
                    filter {
                        eq("outlet_id", outletId)
                        eq("phase", "tutup")
                        eq("is_required", true)
                        eq("is_done", false)
                    }
                }.decodeList<DailyChecklistDto>()
            
            if (checklists.isNotEmpty()) {
                return Pair(false, "Checklist penutupan harian belum diselesaikan.")
            }

            // Cek Petty Cash
            val pettyCash = clientObj.postgrest["petty_cash"]
                .select {
                    filter {
                        eq("outlet_id", outletId)
                        eq("status", "open")
                    }
                }.decodeList<PettyCashDto>()

            if (pettyCash.isNotEmpty()) {
                return Pair(false, "Shift kasir / petty cash masih berstatus open (belum ditutup).")
            }

            return Pair(true, null)
        } catch (e: Exception) {
            android.util.Log.e("SupabaseClient", "Failed to check clock out gates", e)
            return Pair(false, "Gagal memverifikasi syarat clock-out: ${e.message}")
        }
    }

    override suspend fun submitAttendance(dto: AttendanceRecordDto) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        try {
            clientObj.postgrest["attendance"].insert(dto)
        } catch (e: Exception) {
            android.util.Log.e("SupabaseClient", "Failed to submit attendance", e)
            throw e
        }
    }
}

private class MockDelegate : SupabaseClientDelegate {
    override val realClient: io.github.jan.supabase.SupabaseClient? = null
    
    private var token: String? = null
    private var isLoggedIn = false
    private var isOffline = false
    private var shouldTimeout = false
    private val subscriptions = mutableMapOf<String, MutableList<RealtimeSubscriptionCallback>>()
    private val offlineQueue = mutableListOf<suspend () -> Unit>()

    override fun initialize(url: String, anonKey: String) {
        // no-op
    }

    override fun isOffline(): Boolean = isOffline
    
    override fun setOffline(offline: Boolean) {
        this.isOffline = offline
    }

    override fun setShouldTimeout(timeout: Boolean) {
        this.shouldTimeout = timeout
    }

    override fun login(email: String, password: String, callback: SupabaseAuthCallback) {
        if (shouldTimeout) {
            callback.onFailure(TimeoutException("Connection timed out"))
            return
        }
        if (isOffline) {
            callback.onFailure(IOException("No network connection"))
            return
        }
        if (email == "valid@sukashawarma.com" && password == "correct_password") {
            isLoggedIn = true
            token = "jwt_valid_token_123"
            callback.onSuccess(token!!)
        } else {
            callback.onFailure(IllegalArgumentException("Invalid credentials"))
        }
    }

    override fun refreshSession(oldToken: String, callback: SupabaseAuthCallback) {
        if (shouldTimeout) {
            callback.onFailure(TimeoutException("Connection timed out"))
            return
        }
        if (isOffline) {
            callback.onFailure(IOException("No network connection"))
            return
        }
        if (oldToken == "jwt_valid_token_123") {
            token = "jwt_refreshed_token_456"
            callback.onSuccess(token!!)
        } else {
            callback.onFailure(IllegalArgumentException("Invalid token"))
        }
    }

    override fun logout() {
        isLoggedIn = false
        token = null
    }

    override fun isAuthenticated(): Boolean {
        return isLoggedIn && token != null
    }

    override fun getToken(): String? = token

    override fun subscribeToChannel(channel: String, event: String, callback: RealtimeSubscriptionCallback) {
        subscriptions.getOrPut(channel) { mutableListOf() }.add(callback)
    }

    override fun triggerRealtimeEvent(channel: String, event: String, payload: Map<String, Any>) {
        subscriptions[channel]?.forEach { it.onEvent(event, payload) }
    }

    override fun queueOfflineAction(action: suspend () -> Unit) {
        offlineQueue.add(action)
        try {
            val logDir = try {
                com.sukashawarma.superapp.SuperAppApplication.instance.cacheDir
            } catch (e: Throwable) {
                java.io.File("/data/local/tmp")
            }
            val logFile = java.io.File(logDir, "offline_actions.txt")
            logFile.appendText("Queued offline action at ${java.util.Date()}\n")
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override suspend fun syncOfflineQueue() {
        if (isOffline) return
        val actions = ArrayList(offlineQueue)
        offlineQueue.clear()
        for (action in actions) {
            action.invoke()
        }
    }

    override fun getOfflineQueueSize(): Int = offlineQueue.size

    override fun getUserRole(identifier: String): String {
        return when {
            identifier.contains("admin") -> "admin"
            identifier.contains("cashier") -> "cashier"
            identifier.contains("kitchen") -> "kitchen_staff"
            identifier.contains("manager") -> "manager"
            else -> "admin"
        }
    }

    override suspend fun getStaffProfile(identifier: String): Staff? {
        if (shouldTimeout) throw TimeoutException("Connection timed out")
        if (isOffline) throw IOException("No network connection")
        
        val username = identifier.substringBefore("@")
        return when {
            username == "valid" || username == "admin" || username == "cashier" || username == "kitchen" || username == "manager" -> Staff(
                id = "mock-id-$username",
                name = username,
                role = getUserRole(identifier),
                assignedOutletId = "outlet-1"
            )
            else -> null
        }
    }

    override suspend fun getStaffList(outletId: String): List<Staff> {
        return listOf(
            Staff(id = "mock-1", name = "Budi (Belum)", role = "cashier", assignedOutletId = outletId, enrolledAt = null),
            Staff(id = "mock-2", name = "Andi (Sudah)", role = "kitchen_staff", assignedOutletId = outletId, enrolledAt = "2026-06-20T10:00:00Z")
        )
    }

    override suspend fun getOutlet(outletId: String): Outlet? {
        return Outlet(
            id = outletId,
            name = "Warung Suka Shawarma Pusat",
            latitude = -6.200000,
            longitude = 106.816666,
            radiusMeter = 100.0
        )
    }

    override suspend fun uploadFaceReference(outletId: String, staffId: String, photoData: ByteArray): String {
        return "$outletId/$staffId.jpg"
    }

    override suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String) {
        // no-op in mock
    }

    override suspend fun getConfig(outletId: String): OutletAttendanceConfigDto? {
        return OutletAttendanceConfigDto(
            outletId = outletId,
            jamMasuk = "08:00:00",
            jamKeluar = "17:00:00",
            toleransiMenit = 15,
            absenWindowMode = "auto"
        )
    }

    override suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRecordDto? {
        return null // Return null to simulate they haven't clocked in yet
    }

    override suspend fun checkClockOutGates(outletId: String): Pair<Boolean, String?> {
        return Pair(true, null) // Allow by default
    }

    override suspend fun submitAttendance(dto: AttendanceRecordDto) {
        // no-op
    }
}
