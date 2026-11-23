package com.sukashawarma.superapp.ui.features.etoll

import com.sukashawarma.superapp.BuildConfig
import com.sukashawarma.superapp.data.SupabaseClient
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class EtollRepository(
    private val baseUrl: String = BuildConfig.FINANCE_API_BASE.trimEnd('/')
) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val http = HttpClient(OkHttp) {
        install(HttpTimeout) {
            requestTimeoutMillis = 20_000
            connectTimeoutMillis = 15_000
        }
    }

    private fun requireToken(): String {
        return SupabaseClient.getInstance().getToken()?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Sesi login tidak ditemukan. Silakan login ulang.")
    }

    suspend fun submitScan(request: EtollScanRequest): EtollScanResponse = withContext(Dispatchers.IO) {
        val token = requireToken()
        val resp = http.post("$baseUrl/api/etoll/scan") {
            header("Authorization", "Bearer $token")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(request))
        }
        val text = resp.bodyAsText()
        val parsed = runCatching { json.decodeFromString<EtollScanResponse>(text) }.getOrNull()
        if (parsed != null) return@withContext parsed

        EtollScanResponse(
            ok = false,
            error = "Respon server tidak valid (${resp.status.value})"
        )
    }

    suspend fun tagTransaction(txId: String, category: String, note: String?): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val token = requireToken()
                val resp = http.patch("$baseUrl/api/etoll/transactions/$txId/tag") {
                    header("Authorization", "Bearer $token")
                    contentType(ContentType.Application.Json)
                    setBody(json.encodeToString(EtollTagRequest(category = category, note = note)))
                }
                if (resp.status.value !in 200..299) {
                    val text = resp.bodyAsText()
                    throw IllegalStateException("Gagal menyimpan label (${resp.status.value}): $text")
                }
            }
        }

    suspend fun registerCard(request: EtollRegisterCardRequest): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val token = requireToken()
                val resp = http.post("$baseUrl/api/etoll/cards") {
                    header("Authorization", "Bearer $token")
                    contentType(ContentType.Application.Json)
                    setBody(json.encodeToString(request))
                }
                if (resp.status.value !in 200..299) {
                    val text = resp.bodyAsText()
                    throw IllegalStateException("Gagal mendaftarkan kartu (${resp.status.value}): $text")
                }
            }
        }
}
