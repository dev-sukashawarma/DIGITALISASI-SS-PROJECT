package com.sukashawarma.customer.data.api

import android.util.Log
import com.sukashawarma.customer.BuildConfig
import com.sukashawarma.customer.data.SessionStore
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.client.statement.readRawBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

private const val TAG = "SukaGateway"
private const val TIMEOUT_MS = 15_000L

/** Batas ukuran gambar splash yang mau disimpan. Admin sudah mengecilkannya saat unggah. */
const val BATAS_GAMBAR_SPLASH_BYTE = 5 * 1024 * 1024

/**
 * Amplop hasil panggilan gateway: sukses membawa data, gagal membawa
 * [GatewayError] sudah dipetakan lewat [petakanGalat].
 */
sealed class GatewayResult<out T> {
    data class Sukses<T>(val data: T) : GatewayResult<T>()
    data class Gagal(val error: GatewayError) : GatewayResult<Nothing>()
}

/**
 * Klien Retail Gateway. Bicara HANYA ke Retail Gateway (HTTP) — tidak pernah
 * ke Supabase langsung, tidak ada service-role key di aplikasi ini.
 *
 * Menyisipkan `Authorization: Bearer <token>` dari [SessionStore] untuk semua
 * endpoint KECUALI `auth/google`, `catalog`, `outlets`, `banners`, `splash`, dan `config`.
 */
class GatewayClient(
    private val sessionStore: SessionStore,
    private val baseUrl: String = BuildConfig.GATEWAY_BASE_URL
) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(json)
        }
        install(HttpTimeout) {
            requestTimeoutMillis = TIMEOUT_MS
            connectTimeoutMillis = TIMEOUT_MS
            socketTimeoutMillis = TIMEOUT_MS
        }
    }

    private val _sesiHabis = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    /** Memancar sekali setiap kali endpoint terautentikasi membalas HTTP 401. */
    val sesiHabis: SharedFlow<Unit> = _sesiHabis.asSharedFlow()

    fun close() {
        client.close()
    }

    private suspend inline fun <reified T> minta(
        butuhSesi: Boolean = false,
        crossinline panggilan: suspend () -> HttpResponse
    ): GatewayResult<T> {
        return try {
            val response = panggilan()
            if (response.status.isSuccess()) {
                GatewayResult.Sukses(response.body())
            } else {
                val body = runCatching { response.bodyAsText() }.getOrNull()
                val galat = petakanGalat(response.status.value, body)
                if (butuhSesi && galat is GatewayError.SesiTidakSah) {
                    _sesiHabis.tryEmit(Unit)
                }
                GatewayResult.Gagal(galat)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: SerializationException) {
            Log.e(TAG, "Gagal mengurai JSON dari gateway: ${e.message}", e)
            GatewayResult.Gagal(GatewayError.Server(500))
        } catch (e: Exception) {
            Log.w(TAG, "Galat jaringan gateway: ${e.javaClass.simpleName} -- ${e.message}")
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    private suspend fun mintaUnit(
        butuhSesi: Boolean = false,
        panggilan: suspend () -> HttpResponse
    ): GatewayResult<Unit> {
        return try {
            val response = panggilan()
            if (response.status.isSuccess()) {
                GatewayResult.Sukses(Unit)
            } else {
                val body = runCatching { response.bodyAsText() }.getOrNull()
                val galat = petakanGalat(response.status.value, body)
                if (butuhSesi && galat is GatewayError.SesiTidakSah) {
                    _sesiHabis.tryEmit(Unit)
                }
                GatewayResult.Gagal(galat)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Galat jaringan gateway (unit): ${e.javaClass.simpleName} -- ${e.message}")
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    private fun tokenAtauNull(): String? = sessionStore.baca()?.token

    /**
     * Sisipkan header `Authorization` HANYA bila ada token tersimpan. Tanpa
     * penjagaan ini, permintaan sebelum login mengirim literal string
     * `"Bearer null"` — bukan tanpa header sama sekali.
     */
    private fun HttpRequestBuilder.sisipkanOtorisasi() {
        val token = tokenAtauNull()
        if (token != null) header("Authorization", "Bearer $token")
    }

    suspend fun loginGoogle(idToken: String): GatewayResult<AuthResponse> = minta {
        client.post("$baseUrl/api/v1/auth/google") {
            contentType(ContentType.Application.Json)
            setBody(GoogleAuthRequest(idToken))
        }
    }

    suspend fun outlets(): GatewayResult<OutletsResponse> = minta {
        client.get("$baseUrl/api/v1/outlets")
    }

    suspend fun catalog(outletId: String): GatewayResult<CatalogResponse> = minta {
        client.get("$baseUrl/api/v1/catalog") {
            parameter("outlet_id", outletId)
        }
    }

    suspend fun banners(): GatewayResult<BannersResponse> = minta {
        client.get("$baseUrl/api/v1/banners")
    }

    suspend fun splash(): GatewayResult<SplashDto> = minta {
        client.get("$baseUrl/api/v1/splash")
    }

    suspend fun config(): GatewayResult<ConfigDto> = minta {
        client.get("$baseUrl/api/v1/config")
    }

    /**
     * Mengunduh gambar splash. Mengembalikan null untuk apa pun yang bukan
     * gambar raster sungguhan: status gagal, tipe bukan `image/` (atau SVG),
     * Content-Length terlalu besar, berkas kosong, atau melebihi
     * [BATAS_GAMBAR_SPLASH_BYTE]. Tanpa header otorisasi.
     */
    suspend fun unduhGambarSplash(url: String): ByteArray? {
        if (!url.startsWith("https://")) return null
        return try {
            val response = client.get(url)
            if (!response.status.isSuccess()) return null
            val tipe = response.headers[HttpHeaders.ContentType].orEmpty().lowercase()
            if (!tipe.startsWith("image/") || tipe.contains("svg")) return null
            val panjang = response.headers[HttpHeaders.ContentLength]?.toLongOrNull()
            if (panjang != null && panjang > BATAS_GAMBAR_SPLASH_BYTE) return null
            val byte = response.readRawBytes()
            if (byte.isEmpty() || byte.size > BATAS_GAMBAR_SPLASH_BYTE) null else byte
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Gagal mengunduh gambar splash: ${e.message}")
            null
        }
    }

    suspend fun checkoutValidate(
        request: CheckoutValidateRequest
    ): GatewayResult<CheckoutValidateResponse> = minta(butuhSesi = true) {
        client.post("$baseUrl/api/v1/checkout/validate") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(request)
        }
    }

    suspend fun vouchers(request: VouchersRequest): GatewayResult<VouchersResponse> = minta(butuhSesi = true) {
        client.post("$baseUrl/api/v1/vouchers") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(request)
        }
    }

    suspend fun createOrder(request: CreateOrderRequest): GatewayResult<CreateOrderResponse> = minta(butuhSesi = true) {
        client.post("$baseUrl/api/v1/orders") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(request)
        }
    }

    suspend fun orderDetail(orderId: String): GatewayResult<OrderDetailDto> = minta(butuhSesi = true) {
        client.get("$baseUrl/api/v1/orders/$orderId") {
            sisipkanOtorisasi()
        }
    }

    suspend fun cancelOrder(orderId: String): GatewayResult<Unit> = mintaUnit(butuhSesi = true) {
        client.delete("$baseUrl/api/v1/orders/$orderId") {
            sisipkanOtorisasi()
        }
    }

    suspend fun ordersList(): GatewayResult<OrdersListResponse> = minta(butuhSesi = true) {
        client.get("$baseUrl/api/v1/orders/list") {
            sisipkanOtorisasi()
        }
    }

    suspend fun getNotifications(category: String? = null): GatewayResult<NotificationListResponse> = minta(butuhSesi = true) {
        client.get("$baseUrl/api/v1/notifications") {
            sisipkanOtorisasi()
            if (category != null && category != "all") {
                parameter("category", category)
            }
        }
    }

    suspend fun markNotificationRead(notificationId: String? = null, markAll: Boolean = false): GatewayResult<Unit> = mintaUnit(butuhSesi = true) {
        client.post("$baseUrl/api/v1/notifications") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(MarkNotificationReadRequest(notificationId = notificationId, markAll = markAll))
        }
    }

    suspend fun registerFcmToken(request: FcmTokenRequest): GatewayResult<Unit> = mintaUnit(butuhSesi = true) {
        client.post("$baseUrl/api/v1/customer/fcm-token") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(request)
        }
    }

    suspend fun getNotificationPreferences(): GatewayResult<NotificationPreferencesResponse> = minta(butuhSesi = true) {
        client.get("$baseUrl/api/v1/customer/notification-preferences") {
            sisipkanOtorisasi()
        }
    }

    suspend fun profile(): GatewayResult<ProfileResponse> = minta(butuhSesi = true) {
        client.get("$baseUrl/api/v1/customer/profile") {
            sisipkanOtorisasi()
        }
    }

    suspend fun updateProfile(request: UpdateProfileRequest): GatewayResult<ProfileResponse> = minta(butuhSesi = true) {
        client.patch("$baseUrl/api/v1/customer/profile") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(request)
        }
    }

    suspend fun updateNotificationPreferences(request: UpdateNotificationPreferencesRequest): GatewayResult<Unit> = mintaUnit(butuhSesi = true) {
        client.patch("$baseUrl/api/v1/customer/notification-preferences") {
            contentType(ContentType.Application.Json)
            sisipkanOtorisasi()
            setBody(request)
        }
    }

    suspend fun deleteAccount(): GatewayResult<Unit> = mintaUnit(butuhSesi = true) {
        client.delete("$baseUrl/api/v1/customer/profile") {
            sisipkanOtorisasi()
        }
    }
}
