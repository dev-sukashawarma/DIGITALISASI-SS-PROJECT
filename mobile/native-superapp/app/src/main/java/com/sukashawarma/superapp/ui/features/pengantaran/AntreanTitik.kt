package com.sukashawarma.superapp.ui.features.pengantaran

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Antrean titik GPS di berkas (satu JSON per baris) — bertahan saat proses
 * app dimatikan. Titik dihapus hanya setelah server menerimanya.
 * Baris rusak dilewati, tidak menghentikan antrean.
 */
class AntreanTitik(private val file: File) {
    private val json = Json { ignoreUnknownKeys = true }
    private val kunci = Any()

    fun tambah(t: Titik) = synchronized(kunci) {
        file.parentFile?.mkdirs()
        file.appendText(json.encodeToString(t) + "\n")
    }

    fun ambil(maks: Int = 500): List<Titik> = synchronized(kunci) { baca().take(maks) }

    fun hapus(n: Int) = synchronized(kunci) {
        val sisa = baca().drop(n)
        file.writeText(sisa.joinToString("") { json.encodeToString(it) + "\n" })
    }

    fun jumlah(): Int = synchronized(kunci) { baca().size }

    private fun baca(): List<Titik> {
        if (!file.exists()) return emptyList()
        return file.readLines().mapNotNull { baris ->
            if (baris.isBlank()) null
            else runCatching { json.decodeFromString<Titik>(baris) }.getOrNull()
        }
    }
}
