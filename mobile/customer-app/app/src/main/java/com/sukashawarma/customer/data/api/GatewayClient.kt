package com.sukashawarma.customer.data.api

import com.sukashawarma.customer.BuildConfig
import com.sukashawarma.customer.data.SessionStore
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.parameter
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

private const val TIMEOUT_MS = 15_000L

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
 * endpoint KECUALI `auth/google`, `catalog`, dan `outlets`.
 */
class GatewayClient(
    private val sessionStore: SessionStore,
    private val baseUrl: String = BuildConfig.GATEWAY_BASE_URL
) {
    private val json = Json { ignoreUnknownKeys = true }

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

    private suspend inline fun <reified T> hasil(response: HttpResponse): GatewayResult<T> {
        if (response.status.isSuccess()) {
            return GatewayResult.Sukses(response.body())
        }
        val body = runCatching { response.bodyAsText() }.getOrNull()
        return GatewayResult.Gagal(petakanGalat(response.status.value, body))
    }

    private fun tokenAtauNull(): String? = sessionStore.baca()?.token

    /**
     * Sisipkan header `Authorization` HANYA bila ada token tersimpan. Tanpa
     * penjagaan ini, permintaan sebelum login mengirim literal string
     * `"Bearer null"` — bukan tanpa header sama sekali — yang membuat log
     * server menyesatkan (walau gateway tetap membalas 401 di kedua kasus).
     */
    private fun HttpRequestBuilder.sisipkanOtorisasi() {
        val token = tokenAtauNull()
        if (token != null) header("Authorization", "Bearer $token")
    }

    suspend fun loginGoogle(idToken: String): GatewayResult<AuthResponse> {
        return try {
            val response = client.post("$baseUrl/api/v1/auth/google") {
                contentType(ContentType.Application.Json)
                setBody(GoogleAuthRequest(idToken))
            }
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    suspend fun outlets(): GatewayResult<OutletsResponse> {
        return try {
            val response = client.get("$baseUrl/api/v1/outlets")
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    suspend fun catalog(outletId: String): GatewayResult<CatalogResponse> {
        return try {
            val response = client.get("$baseUrl/api/v1/catalog") {
                parameter("outlet_id", outletId)
            }
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    suspend fun checkoutValidate(
        request: CheckoutValidateRequest
    ): GatewayResult<CheckoutValidateResponse> {
        return try {
            val response = client.post("$baseUrl/api/v1/checkout/validate") {
                contentType(ContentType.Application.Json)
                sisipkanOtorisasi()
                setBody(request)
            }
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    suspend fun createOrder(request: CreateOrderRequest): GatewayResult<CreateOrderResponse> {
        return try {
            val response = client.post("$baseUrl/api/v1/orders") {
                contentType(ContentType.Application.Json)
                sisipkanOtorisasi()
                setBody(request)
            }
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    suspend fun orderDetail(orderId: String): GatewayResult<OrderDetailDto> {
        return try {
            val response = client.get("$baseUrl/api/v1/orders/$orderId") {
                sisipkanOtorisasi()
            }
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }

    suspend fun ordersList(): GatewayResult<OrdersListResponse> {
        return try {
            val response = client.get("$baseUrl/api/v1/orders/list") {
                sisipkanOtorisasi()
            }
            hasil(response)
        } catch (e: Exception) {
            GatewayResult.Gagal(GatewayError.Jaringan(e))
        }
    }
}
