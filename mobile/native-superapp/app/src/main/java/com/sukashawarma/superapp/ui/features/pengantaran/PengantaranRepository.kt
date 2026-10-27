package com.sukashawarma.superapp.ui.features.pengantaran

import com.sukashawarma.superapp.data.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

data class HasilTiba(val jarakM: Double?, val statusPerjalanan: String)

/** RPC pelacakan driver (migration 20261027141000). Identitas driver dari sesi login. */
interface PengantaranApi {
    suspend fun sjSiap(): List<SjSiap>
    suspend fun mulai(sjIds: List<String>, lat: Double, lng: Double): Pair<String, Pengaturan>
    suspend fun ubahUrutan(perjalananId: String, stopIds: List<String>)
    suspend fun tandaiTiba(stopId: String, lat: Double, lng: Double, akurasiM: Float?): HasilTiba
    suspend fun kirimLokasi(titik: List<Titik>): HasilKirim
    suspend fun selesaikan(perjalananId: String): RingkasanPerjalanan
    suspend fun perjalananAktif(): PerjalananUi?
}

/**
 * @param rpc memanggil fungsi Postgres dan mengembalikan JSON mentah. Bawaan:
 * client supabase-kt milik app; di tes diganti fungsi palsu.
 */
class PengantaranRepository(
    private val rpc: suspend (String, JsonObject) -> String = { nama, param ->
        SupabaseClient.client.postgrest.rpc(nama, param).data
    },
) : PengantaranApi {

    override suspend fun sjSiap(): List<SjSiap> =
        parse(rpc("driver_sj_siap_dibawa", JsonObject(emptyMap()))).jsonArray.map {
            val o = it.jsonObject
            SjSiap(
                suratJalanId = o.str("surat_jalan_id")!!,
                documentNumber = o.str("document_number"),
                outletId = o.str("outlet_id")!!,
                outletName = o.str("outlet_name") ?: "Outlet",
                lat = o.dbl("lat"),
                lng = o.dbl("lng"),
                jumlahItem = o.int("jumlah_item") ?: 0,
            )
        }

    override suspend fun mulai(sjIds: List<String>, lat: Double, lng: Double): Pair<String, Pengaturan> {
        val o = parse(rpc("driver_mulai_perjalanan", buildJsonObject {
            putJsonArray("p_sj_ids") { sjIds.forEach { add(JsonPrimitive(it)) } }
            put("p_lat", lat)
            put("p_lng", lng)
        })).jsonObject
        return o.str("perjalanan_id")!! to pengaturan(o["pengaturan"])
    }

    override suspend fun ubahUrutan(perjalananId: String, stopIds: List<String>) {
        rpc("driver_ubah_urutan", buildJsonObject {
            put("p_perjalanan_id", perjalananId)
            putJsonArray("p_stop_ids") { stopIds.forEach { add(JsonPrimitive(it)) } }
        })
    }

    override suspend fun tandaiTiba(stopId: String, lat: Double, lng: Double, akurasiM: Float?): HasilTiba {
        val o = parse(rpc("driver_tandai_tiba", buildJsonObject {
            put("p_stop_id", stopId)
            put("p_lat", lat)
            put("p_lng", lng)
            put("p_akurasi_m", akurasiM)
        })).jsonObject
        return HasilTiba(o.dbl("tiba_jarak_m"), o.str("perjalanan_status") ?: "berjalan")
    }

    override suspend fun kirimLokasi(titik: List<Titik>): HasilKirim {
        val o = parse(rpc("driver_kirim_lokasi", buildJsonObject {
            putJsonArray("p_titik") {
                titik.forEach { t ->
                    add(buildJsonObject {
                        put("lat", t.lat)
                        put("lng", t.lng)
                        put("akurasi_m", t.akurasiM)
                        put("kecepatan_mps", t.kecepatanMps)
                        put("arah_derajat", t.arahDerajat)
                        put("baterai_persen", t.bateraiPersen)
                        put("direkam_at", keIsoUtc(t.waktuMs))
                    })
                }
            }
        })).jsonObject
        return HasilKirim(o.str("status_perjalanan") ?: "tidak_ada", pengaturan(o["pengaturan"]), o.int("diterima") ?: 0)
    }

    override suspend fun selesaikan(perjalananId: String): RingkasanPerjalanan {
        val o = parse(rpc("driver_selesaikan_perjalanan", buildJsonObject { put("p_perjalanan_id", perjalananId) })).jsonObject
        return RingkasanPerjalanan(o.dbl("total_km"), o.int("durasi_detik"))
    }

    override suspend fun perjalananAktif(): PerjalananUi? {
        val el = parse(rpc("driver_perjalanan_aktif", JsonObject(emptyMap())))
        if (el is JsonNull) return null
        val o = el.jsonObject
        val p = o["perjalanan"]!!.jsonObject
        return PerjalananUi(
            id = p.str("id")!!,
            berangkatAtIso = p.str("berangkat_at")!!,
            pengaturan = pengaturan(o["pengaturan"]),
            stops = (o["stops"] as? JsonArray).orEmpty().map { it.jsonObject.keStop() }.sortedBy { it.urutan },
        )
    }

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        private fun parse(teks: String): JsonElement = if (teks.isBlank()) JsonNull else json.parseToJsonElement(teks)

        private fun JsonObject.str(k: String): String? = (this[k] as? JsonPrimitive)?.takeUnless { it is JsonNull }?.contentOrNull
        private fun JsonObject.dbl(k: String): Double? = (this[k] as? JsonPrimitive)?.takeUnless { it is JsonNull }?.doubleOrNull
        private fun JsonObject.int(k: String): Int? = (this[k] as? JsonPrimitive)?.takeUnless { it is JsonNull }?.let { it.intOrNull ?: it.doubleOrNull?.toInt() }

        fun pengaturan(el: JsonElement?): Pengaturan {
            val o = el as? JsonObject ?: return Pengaturan()
            val bawaan = Pengaturan()
            return Pengaturan(
                intervalDetik = o.int("interval_detik") ?: bawaan.intervalDetik,
                jarakMinM = o.int("jarak_min_m") ?: bawaan.jarakMinM,
                batasTutupWib = o.str("batas_tutup_wib") ?: bawaan.batasTutupWib,
            )
        }

        private fun JsonObject.keStop() = StopUi(
            id = str("id")!!,
            suratJalanId = str("surat_jalan_id")!!,
            documentNumber = str("document_number"),
            outletName = str("outlet_name") ?: "Outlet",
            urutan = int("urutan") ?: 0,
            status = str("status") ?: "menunggu",
            tibaAtIso = str("tiba_at"),
            tibaSumber = str("tiba_sumber"),
            tibaJarakM = dbl("tiba_jarak_m"),
        )
    }
}

/** Mengirim antrean titik per batch 500 sampai habis atau gagal; titik dihapus hanya setelah diterima server. */
class PengirimAntrean(private val api: PengantaranApi, private val antrean: AntreanTitik) {
    suspend fun kirimSemua(): HasilKirim? {
        var terakhir: HasilKirim? = null
        while (true) {
            val batch = antrean.ambil(BATCH)
            if (batch.isEmpty()) return terakhir
            terakhir = try {
                api.kirimLokasi(batch)
            } catch (e: Exception) {
                return terakhir
            }
            antrean.hapus(batch.size)
            if (batch.size < BATCH) return terakhir
        }
    }

    companion object {
        const val BATCH = 500
    }
}
