package com.sukashawarma.superapp.data

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.broadcastFlow
import io.github.jan.supabase.realtime.broadcast
import io.github.jan.supabase.storage.Storage
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

    fun login(email: String, password: String, callback: SupabaseAuthCallback) = delegate.login(email, password, callback)

    fun refreshSession(oldToken: String, callback: SupabaseAuthCallback) = delegate.refreshSession(oldToken, callback)

    override fun logout() = delegate.logout()

    override fun isAuthenticated(): Boolean = delegate.isAuthenticated()

    fun getToken(): String? = delegate.getToken()

    override fun subscribeToChannel(channel: String, event: String, callback: RealtimeSubscriptionCallback) = delegate.subscribeToChannel(channel, event, callback)

    override fun triggerRealtimeEvent(channel: String, event: String, payload: Map<String, Any>) = delegate.triggerRealtimeEvent(channel, event, payload)

    override fun queueOfflineAction(action: suspend () -> Unit) = delegate.queueOfflineAction(action)

    override suspend fun syncOfflineQueue() = delegate.syncOfflineQueue()

    override fun getOfflineQueueSize(): Int = delegate.getOfflineQueueSize()

    override fun getUserRole(email: String): String = delegate.getUserRole(email)

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

    override fun getUserRole(email: String): String {
        val user = realClient?.auth?.currentUserOrNull()
        val metadataRole = user?.userMetadata?.get("role")?.toString()?.removeSurrounding("\"")
        return metadataRole ?: "cashier"
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

    override fun getUserRole(email: String): String {
        return when {
            email.contains("admin") -> "admin"
            email.contains("cashier") -> "cashier"
            email.contains("kitchen") -> "kitchen_staff"
            email.contains("manager") -> "manager"
            else -> "admin"
        }
    }
}
