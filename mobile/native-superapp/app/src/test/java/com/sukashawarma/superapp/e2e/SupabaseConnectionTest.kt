package com.sukashawarma.superapp.e2e

import com.sukashawarma.superapp.data.SupabaseAuthCallback
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.data.RealtimeSubscriptionCallback
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException
import java.util.concurrent.TimeoutException

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], manifest = Config.NONE)
class SupabaseConnectionTest {

    private lateinit var client: SupabaseClient

    @Before
    fun setUp() {
        client = SupabaseClient()
    }

    // --- TIER 1: Feature Coverage ---

    @Test
    fun testTier1_LoginSuccessSetsToken() {
        var callbackSuccess = false
        var callbackToken: String? = null
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                callbackSuccess = true
                callbackToken = token
            }
            override fun onFailure(error: Throwable) {
                fail("Login should succeed")
            }
        })
        assertTrue(callbackSuccess)
        assertEquals("jwt_valid_token_123", callbackToken)
        assertTrue(client.isAuthenticated())
        assertEquals("jwt_valid_token_123", client.getToken())
    }

    @Test
    fun testTier1_LoginWithUsernameAppendsDomain() {
        var callbackSuccess = false
        // "valid" should be normalized to "valid@sukashawarma.com"
        client.login("valid", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                callbackSuccess = true
            }
            override fun onFailure(error: Throwable) {
                fail("Login with username should succeed")
            }
        })
        assertTrue(callbackSuccess)
        assertTrue(client.isAuthenticated())
    }

    @Test
    fun testTier1_TokenRefreshUpdatesSession() {
        // Login first
        var loggedInToken: String? = null
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                loggedInToken = token
            }
            override fun onFailure(error: Throwable) {}
        })
        assertNotNull(loggedInToken)

        // Refresh token
        var refreshSuccess = false
        var refreshedToken: String? = null
        client.refreshSession(loggedInToken!!, object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                refreshSuccess = true
                refreshedToken = token
            }
            override fun onFailure(error: Throwable) {
                fail("Session refresh should succeed")
            }
        })
        assertTrue(refreshSuccess)
        assertEquals("jwt_refreshed_token_456", refreshedToken)
        assertEquals("jwt_refreshed_token_456", client.getToken())
        assertTrue(client.isAuthenticated())
    }

    @Test
    fun testTier1_LogoutClearsSession() {
        // Login
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {}
            override fun onFailure(error: Throwable) {}
        })
        assertTrue(client.isAuthenticated())
        assertNotNull(client.getToken())

        // Logout
        client.logout()
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
    }

    @Test
    fun testTier1_OfflineStateStatusVerification() {
        assertFalse(client.isOffline())
        client.setOffline(true)
        assertTrue(client.isOffline())
        client.setOffline(false)
        assertFalse(client.isOffline())
    }

    @Test
    fun testTier1_GetAuthenticationStatusDefault() {
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
    }

    // --- TIER 2: Boundary / Corner Cases ---

    @Test
    fun testTier2_InvalidCredentialsFails() {
        var callbackFailure = false
        var failureException: Throwable? = null
        client.login("invalid@sukashawarma.com", "wrong_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                fail("Login should fail")
            }
            override fun onFailure(error: Throwable) {
                callbackFailure = true
                failureException = error
            }
        })
        assertTrue(callbackFailure)
        assertTrue(failureException is IllegalArgumentException)
        assertEquals("Invalid credentials", failureException?.message)
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
    }

    @Test
    fun testTier2_OfflineLoginThrowsIOException() {
        client.setOffline(true)
        var callbackFailure = false
        var failureException: Throwable? = null
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                fail("Login should fail when offline")
            }
            override fun onFailure(error: Throwable) {
                callbackFailure = true
                failureException = error
            }
        })
        assertTrue(callbackFailure)
        assertTrue(failureException is IOException)
        assertEquals("No network connection", failureException?.message)
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
    }

    @Test
    fun testTier2_TimeoutLoginThrowsTimeoutException() {
        client.setShouldTimeout(true)
        var callbackFailure = false
        var failureException: Throwable? = null
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                fail("Login should fail when timing out")
            }
            override fun onFailure(error: Throwable) {
                callbackFailure = true
                failureException = error
            }
        })
        assertTrue(callbackFailure)
        assertTrue(failureException is TimeoutException)
        assertEquals("Connection timed out", failureException?.message)
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
    }

    @Test
    fun testTier2_RefreshWithExpiredTokenFails() {
        var callbackFailure = false
        var failureException: Throwable? = null
        client.refreshSession("expired_or_invalid_token", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                fail("Refresh should fail with invalid token")
            }
            override fun onFailure(error: Throwable) {
                callbackFailure = true
                failureException = error
            }
        })
        assertTrue(callbackFailure)
        assertTrue(failureException is IllegalArgumentException)
        assertEquals("Invalid token", failureException?.message)
    }

    @Test
    fun testTier2_BlankEmailTriggersValidation() {
        var callbackFailure = false
        var failureException: Throwable? = null
        client.login("", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {
                fail("Login should fail with blank email")
            }
            override fun onFailure(error: Throwable) {
                callbackFailure = true
                failureException = error
            }
        })
        assertTrue(callbackFailure)
        assertTrue(failureException is IllegalArgumentException)
    }

    // --- TIER 3: Cross-Feature Combinations ---

    @Test
    fun testTier3_OfflineQueueAddedOnFailedOperations() = runBlocking {
        client.setOffline(true)
        var operationExecuted = false
        
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) {}
            override fun onFailure(error: Throwable) {
                if (error is IOException) {
                    client.queueOfflineAction {
                        client.setOffline(false)
                        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
                            override fun onSuccess(token: String) {
                                operationExecuted = true
                            }
                            override fun onFailure(error: Throwable) {}
                        })
                    }
                }
            }
        })
        
        assertEquals(1, client.getOfflineQueueSize())
        assertFalse(operationExecuted)
        
        client.setOffline(false)
        client.syncOfflineQueue()
        
        assertEquals(0, client.getOfflineQueueSize())
        assertTrue(operationExecuted)
        assertTrue(client.isAuthenticated())
    }

    // --- TIER 4: Real-World Workload ---

    @Test
    fun testTier4_FullAuthLifecycleWorkflow() = runBlocking {
        // 1. Initial State Check
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
        
        // 2. Failed Login - Invalid Credentials
        var loginError: Throwable? = null
        client.login("bad@email.com", "pass", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) { fail("Should fail") }
            override fun onFailure(error: Throwable) { loginError = error }
        })
        assertNotNull(loginError)
        assertTrue(loginError is IllegalArgumentException)
        assertFalse(client.isAuthenticated())
        
        // 3. Failed Login - Offline state
        client.setOffline(true)
        var offlineError: Throwable? = null
        client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
            override fun onSuccess(token: String) { fail("Should fail when offline") }
            override fun onFailure(error: Throwable) { offlineError = error }
        })
        assertNotNull(offlineError)
        assertTrue(offlineError is IOException)
        
        // Queue login action for retry
        var retryCompleted = false
        client.queueOfflineAction {
            client.login("valid@sukashawarma.com", "correct_password", object : SupabaseAuthCallback {
                override fun onSuccess(token: String) { retryCompleted = true }
                override fun onFailure(error: Throwable) {}
            })
        }
        assertEquals(1, client.getOfflineQueueSize())
        
        // 4. Recover connection and sync queue
        client.setOffline(false)
        client.syncOfflineQueue()
        assertEquals(0, client.getOfflineQueueSize())
        assertTrue(retryCompleted)
        assertTrue(client.isAuthenticated())
        assertEquals("jwt_valid_token_123", client.getToken())
        
        // 5. Setup channel subscription to listen for logout events
        var logoutEventReceived = false
        client.subscribeToChannel("user_sessions", "session_revoked", object : RealtimeSubscriptionCallback {
            override fun onEvent(event: String, payload: Map<String, Any>) {
                if (event == "session_revoked") {
                    client.logout()
                    logoutEventReceived = true
                }
            }
        })
        
        // 6. Refresh Token
        var refreshed = false
        client.refreshSession(client.getToken()!!, object : SupabaseAuthCallback {
            override fun onSuccess(token: String) { refreshed = true }
            override fun onFailure(error: Throwable) {}
        })
        assertTrue(refreshed)
        assertEquals("jwt_refreshed_token_456", client.getToken())
        
        // 7. Simulate logout via realtime event callback
        client.triggerRealtimeEvent("user_sessions", "session_revoked", emptyMap())
        assertTrue(logoutEventReceived)
        assertFalse(client.isAuthenticated())
        assertNull(client.getToken())
    }

    @Test
    fun testGetUserRole_TestingMode() {
        assertEquals("admin", client.getUserRole("admin@sukashawarma.com"))
        assertEquals("cashier", client.getUserRole("cashier@sukashawarma.com"))
        assertEquals("kitchen_staff", client.getUserRole("kitchen@sukashawarma.com"))
        assertEquals("manager", client.getUserRole("manager@sukashawarma.com"))
        assertEquals("admin", client.getUserRole("other@sukashawarma.com"))
    }

    @Test
    fun testOfflineQueuePersistenceLogging() {
        val hasInstance = try {
            com.sukashawarma.superapp.SuperAppApplication.instance
            true
        } catch (e: Throwable) {
            false
        }

        val logDir = if (hasInstance) {
            com.sukashawarma.superapp.SuperAppApplication.instance.cacheDir
        } else {
            java.io.File(System.getProperty("java.io.tmpdir") ?: ".")
        }

        val logFile = java.io.File(logDir, "offline_actions.txt")
        if (logFile.exists()) {
            logFile.delete()
        }
        assertFalse(logFile.exists())

        client.queueOfflineAction {
            // No-op
        }

        assertTrue(logFile.exists())
        val logContent = logFile.readText()
        assertTrue(logContent.contains("Queued offline action at"))
        logFile.delete() // Clean up
    }

    @Test
    fun testCompanionSingletonInitialization() {
        val newClient = SupabaseClient.initialize("https://test-url.co", "test-key")
        assertTrue(SupabaseClient.isInitialized())
        assertEquals(newClient, SupabaseClient.getInstance())
        assertFalse(newClient.isTesting)
    }

    @Test
    fun testOfflineQueueCacheDirRouting() {
        val testCacheDir = java.io.File(System.getProperty("java.io.tmpdir"), "test_cache_dir")
        testCacheDir.mkdirs()
        
        val dummyApp = object : com.sukashawarma.superapp.SuperAppApplication() {
            override fun getCacheDir(): java.io.File = testCacheDir
        }
        
        // Reflectively set SuperAppApplication.instance
        try {
            val field = com.sukashawarma.superapp.SuperAppApplication::class.java.getDeclaredField("instance")
            field.isAccessible = true
            field.set(null, dummyApp)
        } catch (e: Exception) {
            val companionClass = Class.forName("com.sukashawarma.superapp.SuperAppApplication\$Companion")
            val field = companionClass.getDeclaredField("instance")
            field.isAccessible = true
            field.set(com.sukashawarma.superapp.SuperAppApplication.Companion, dummyApp)
        }

        val logFile = java.io.File(testCacheDir, "offline_actions.txt")
        if (logFile.exists()) {
            logFile.delete()
        }
        assertFalse(logFile.exists())

        client.queueOfflineAction {
            // No-op
        }

        assertTrue(logFile.exists())
        val logContent = logFile.readText()
        assertTrue(logContent.contains("Queued offline action at"))

        // Cleanup
        logFile.delete()
        testCacheDir.delete()

        // Reset the companion instance by setting it to null reflectively
        try {
            val field = com.sukashawarma.superapp.SuperAppApplication::class.java.getDeclaredField("instance")
            field.isAccessible = true
            field.set(null, null)
        } catch (e: Exception) {
            val companionClass = Class.forName("com.sukashawarma.superapp.SuperAppApplication\$Companion")
            val field = companionClass.getDeclaredField("instance")
            field.isAccessible = true
            field.set(com.sukashawarma.superapp.SuperAppApplication.Companion, null)
        }
    }
}
