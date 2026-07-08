package com.sukashawarma.superapp.data

interface AuthRepository {
    fun isAuthenticated(): Boolean
    fun logout()
    fun getUserRole(identifier: String): String
    suspend fun getStaffProfile(identifier: String): Staff?
}

interface RealtimeSubscriptionCallback {
    fun onEvent(event: String, payload: Map<String, Any>)
}

interface RealtimeRepository {
    fun subscribeToChannel(channel: String, event: String, callback: RealtimeSubscriptionCallback)
    fun triggerRealtimeEvent(channel: String, event: String, payload: Map<String, Any>)
}

interface SyncRepository {
    fun isOffline(): Boolean
    fun setOffline(offline: Boolean)
    fun queueOfflineAction(action: suspend () -> Unit)
    suspend fun syncOfflineQueue()
    fun getOfflineQueueSize(): Int
}
