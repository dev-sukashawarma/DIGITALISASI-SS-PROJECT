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
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
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
    suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean)
    
    // Attendance Methods
    suspend fun getConfig(outletId: String): OutletAttendanceConfigDto?
    suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRowDto?
    // Submit lewat endpoint web absensi (bukan insert langsung — RLS attendance hanya izinkan service_role).
    // Gate clock-out (shift kasir, dll.) dievaluasi server, dibalas sebagai reason (mis. "shift_not_closed").
    suspend fun submitAttendance(request: AttendanceSubmitRequest): SubmitAttendanceResponse
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
    suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean) =
        delegate.saveEnrollment(staffId, descriptor, photoUrl, isReEnroll, reason, adminId, hasExistingConsent)

    suspend fun getConfig(outletId: String): OutletAttendanceConfigDto? = delegate.getConfig(outletId)
    suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRowDto? = delegate.getTodayAttendance(staffId, type)
    suspend fun submitAttendance(request: AttendanceSubmitRequest): SubmitAttendanceResponse = delegate.submitAttendance(request)

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
            try {
                action.invoke()
            } catch (e: Exception) {
                // Gagal (jaringan masih putus / server error) → kembalikan ke queue, jangan hilang.
                android.util.Log.w("OfflineQueue", "Sync gagal, action dikembalikan ke queue: ${e.message}")
                offlineQueue.add(action)
            }
        }
    }

    override fun getOfflineQueueSize(): Int = offlineQueue.size

    override fun getUserRole(identifier: String): String {
        val user = realClient?.auth?.currentUserOrNull()
        val metadataRole = user?.userMetadata?.get("role")?.toString()?.removeSurrounding("\"")
        return metadataRole ?: "crew"
    }

    override suspend fun getStaffProfile(identifier: String): Staff? {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        val session = clientObj.auth.currentSessionOrNull()
        val userId = session?.user?.id ?: throw IllegalStateException("User session not found")
        val username = identifier.substringBefore("@")
        
        // Hanya ambil kolom utama, HINDARI JOIN (outlets(name)) karena sering menyebabkan PostgREST error
        // Kolom MOBILE (bukan kolom web face_descriptor/enrolled_at/ref_photo_url yang dipakai app absensi web produksi)
        val cols = io.github.jan.supabase.postgrest.query.Columns.raw("id, outlet_id, name, role, face_descriptor_mobile, mobile_enrolled_at, ref_photo_url_mobile, consent_at, consent_by")
        
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
            outletId = result.outletId,
            faceDescriptor = result.faceDescriptorMobile?.toFloatArray(),
            enrolledAt = result.mobileEnrolledAt,
            refPhotoUrl = result.refPhotoUrlMobile,
            consentAt = result.consentAt,
            consentBy = result.consentBy
        )
    }

    override suspend fun getStaffList(outletId: String): List<Staff> {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        // Kolom MOBILE (bukan kolom web face_descriptor/enrolled_at/ref_photo_url yang dipakai app absensi web produksi)
        val cols = io.github.jan.supabase.postgrest.query.Columns.raw("id, outlet_id, name, role, face_descriptor_mobile, mobile_enrolled_at, ref_photo_url_mobile, consent_at, consent_by")
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
                outletId = result.outletId,
                faceDescriptor = result.faceDescriptorMobile?.toFloatArray(),
                enrolledAt = result.mobileEnrolledAt,
                refPhotoUrl = result.refPhotoUrlMobile,
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
        val refPath = "$outletId/${staffId}_mobile.jpg"
        clientObj.storage.from("face-refs").upload(
            path = refPath,
            data = photoData
        ) {
            upsert = true
        }
        return refPath
    }

    override suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean) {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        val now = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(java.util.Date())

        android.util.Log.d("ENROLL", "Saving MOBILE descriptor ${descriptor.size}d for $staffId")

        val payload = EnrollmentPayload.build(descriptor, photoUrl, now, adminId, isReEnroll, reason, hasExistingConsent)
        clientObj.postgrest["outlet_staff"].update(payload) {
            filter { eq("id", staffId) }
        }
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

    override suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRowDto? {
        val clientObj = realClient ?: throw IllegalStateException("Supabase client not initialized")
        return try {
            // Kita cari dari awal hari berdasarkan timezone (ideal di query, tapi sementara ambil limit 1 descending)
            val todayDateStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("Asia/Jakarta")
            }.format(java.util.Date())

            val cols = io.github.jan.supabase.postgrest.query.Columns.raw("id, outlet_staff_id, outlet_id, type, ts_client, ts_server, status")
            clientObj.postgrest["attendance"]
                .select(columns = cols) {
                    filter {
                        eq("outlet_staff_id", staffId)
                        eq("type", type)
                        gte("ts_client", "${todayDateStr}T00:00:00+07:00")
                    }
                    order("ts_client", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    limit(1)
                }
                .decodeSingleOrNull<AttendanceRowDto>()
        } catch (e: Exception) {
            android.util.Log.e("SupabaseClient", "Failed to fetch today attendance", e)
            null
        }
    }

    // HttpClient khusus untuk endpoint web absensi (bukan postgrest). Lazy sekali pakai selamanya.
    private val attendanceHttpClient by lazy {
        io.ktor.client.HttpClient(io.ktor.client.engine.okhttp.OkHttp) {
            expectSuccess = false // server pakai 4xx untuk beberapa reason — body tetap harus dibaca
            install(HttpTimeout) { requestTimeoutMillis = 15000 }
        }
    }
    private val attendanceJson = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    override suspend fun submitAttendance(request: AttendanceSubmitRequest): SubmitAttendanceResponse {
        val url = com.sukashawarma.superapp.BuildConfig.ABSENSI_API_BASE + "/api/submit-attendance"
        val response = attendanceHttpClient.post(url) {
            setBody(
                io.ktor.http.content.TextContent(
                    attendanceJson.encodeToString(AttendanceSubmitRequest.serializer(), request),
                    io.ktor.http.ContentType.Application.Json
                )
            )
        }
        val bodyText = response.bodyAsText()
        return try {
            // Non-2xx dengan body JSON reason tetap di-parse & dikembalikan apa adanya
            attendanceJson.decodeFromString(SubmitAttendanceResponse.serializer(), bodyText)
        } catch (e: Exception) {
            // Server MERESPONS tapi bukan JSON kontrak (HTML 502/maintenance/captive-portal) —
            // BUKAN offline: jangan sampai di-queue oleh caller. Transport error ktor propagate apa adanya di atas.
            android.util.Log.e("SupabaseClient", "submit-attendance non-JSON response (HTTP ${response.status.value})", e)
            throw AttendanceServerException("Respons server tidak dikenali (HTTP ${response.status.value}): ${bodyText.take(120)}")
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
            try {
                action.invoke()
            } catch (e: Exception) {
                // Gagal (jaringan masih putus / server error) → kembalikan ke queue, jangan hilang.
                android.util.Log.w("OfflineQueue", "Sync gagal, action dikembalikan ke queue: ${e.message}")
                offlineQueue.add(action)
            }
        }
    }

    override fun getOfflineQueueSize(): Int = offlineQueue.size

    override fun getUserRole(identifier: String): String {
        return when {
            identifier.contains("admin") -> "admin"
            identifier.contains("kasir") -> "kasir"
            identifier.contains("kitchen") -> "kitchen"
            identifier.contains("spv") -> "spv"
            else -> "admin"
        }
    }

    override suspend fun getStaffProfile(identifier: String): Staff? {
        if (shouldTimeout) throw TimeoutException("Connection timed out")
        if (isOffline) throw IOException("No network connection")

        val username = identifier.substringBefore("@")
        return when {
            username == "valid" || username == "admin" || username == "kasir" || username == "kitchen" || username == "spv" -> Staff(
                id = "mock-id-$username",
                name = username,
                role = getUserRole(identifier),
                assignedOutletId = "outlet-1",
                outletId = "outlet-1"
            )
            else -> null
        }
    }

    override suspend fun getStaffList(outletId: String): List<Staff> {
        return listOf(
            Staff(id = "mock-1", name = "Budi (Belum)", role = "kasir", assignedOutletId = outletId, enrolledAt = null),
            Staff(id = "mock-2", name = "Andi (Sudah)", role = "kitchen", assignedOutletId = outletId, enrolledAt = "2026-06-20T10:00:00Z")
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
        return "$outletId/${staffId}_mobile.jpg"
    }

    override suspend fun saveEnrollment(staffId: String, descriptor: FloatArray, photoUrl: String, isReEnroll: Boolean, reason: String?, adminId: String, hasExistingConsent: Boolean) {
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

    override suspend fun getTodayAttendance(staffId: String, type: String): AttendanceRowDto? {
        return null // Return null to simulate they haven't clocked in yet
    }

    override suspend fun submitAttendance(request: AttendanceSubmitRequest): SubmitAttendanceResponse {
        if (isOffline) throw IOException("No network connection")
        return SubmitAttendanceResponse(ok = true, status = "tepat")
    }
}
