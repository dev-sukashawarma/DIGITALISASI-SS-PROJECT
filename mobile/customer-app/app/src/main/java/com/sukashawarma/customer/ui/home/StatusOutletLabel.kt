package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.OutletDto
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val WIB: ZoneId = ZoneId.of("Asia/Jakarta")
private val JAM = DateTimeFormatter.ofPattern("HH.mm")

/** Gateway lama (tanpa `bisa_pesan`) = perilaku lama: ikut `isActive`. */
fun OutletDto.bolehPesan(): Boolean = bisaPesan ?: isActive

fun labelStatusOutlet(o: OutletDto): String {
    if (o.bolehPesan()) {
        val terakhir = o.pesanTerakhir?.let {
            runCatching { JAM.format(Instant.parse(it).atZone(WIB)) }.getOrNull()
        }
        return if (terakhir != null) "Buka · pesan terakhir $terakhir" else "Buka"
    }
    return o.pesanStatus ?: "Tutup"
}
