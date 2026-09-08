package com.sukashawarma.customer.data.api

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

sealed class GatewayError {
    /**
     * Gateway menolak dengan alasan yang bisa ditindak. `kode` bisa berupa
     * kode mesin (`pesanan_kadaluarsa`) atau kalimat bebas — gateway memakai
     * keduanya. Cocokkan kode mesin dulu; kalau tidak dikenal, tampilkan
     * `pesan` apa adanya.
     */
    data class Kode(val kode: String, val pesan: String) : GatewayError()

    data class Jaringan(val sebab: Throwable) : GatewayError()
    data class Server(val status: Int) : GatewayError()
    object SesiTidakSah : GatewayError()
}

private val json = Json { ignoreUnknownKeys = true }

fun petakanGalat(status: Int, body: String?): GatewayError {
    if (status == 401) return GatewayError.SesiTidakSah
    if (status >= 500) return GatewayError.Server(status)

    val terurai = runCatching { json.parseToJsonElement(body ?: "").jsonObject }.getOrNull()
        ?: return GatewayError.Server(status)

    val kode = terurai["error"]?.jsonPrimitive?.contentOrNull ?: return GatewayError.Server(status)
    val pesan = terurai["pesan"]?.jsonPrimitive?.contentOrNull ?: kode

    return GatewayError.Kode(kode, pesan)
}
