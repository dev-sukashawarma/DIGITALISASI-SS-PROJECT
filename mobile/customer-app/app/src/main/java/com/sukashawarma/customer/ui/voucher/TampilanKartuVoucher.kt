package com.sukashawarma.customer.ui.voucher

import com.sukashawarma.customer.data.api.VoucherDto
import java.time.OffsetDateTime
import java.time.ZoneId

/** Warna potongan kiri kartu. Dipetakan ke warna tema di [KartuVoucher]. */
enum class WarnaKartu { ORANYE, COKELAT, HIJAU, PUDAR }

private val NAMA_BULAN = listOf("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")
private val WIB = ZoneId.of("Asia/Jakarta")

/**
 * Nilai besar + keterangan kecil di potongan kiri kartu. Sumbernya
 * `label_nilai`/`label_sub` dari gateway; gateway lama yang belum
 * mengirimnya tetap mendapat teks, bukan potongan kosong.
 */
fun nilaiKartu(v: VoucherDto): Pair<String, String> {
    if (v.labelNilai != null) return v.labelNilai to (v.labelSub ?: "")
    return when (v.jenis) {
        "persen" -> "%" to "potongan"
        "gratis_item" -> "Gratis" to "voucher"
        else -> "Promo" to "voucher"
    }
}

fun warnaKartu(v: VoucherDto): WarnaKartu = when {
    v.status != "berlaku" -> WarnaKartu.PUDAR
    v.jenis == "persen" -> WarnaKartu.COKELAT
    v.jenis == "gratis_item" || v.jenis == "beli_x_gratis_y" -> WarnaKartu.HIJAU
    else -> WarnaKartu.ORANYE
}

/** "s.d. 30 Sep" dalam WIB; null bila tanpa tanggal atau tak terbaca. */
fun labelBerlakuSampai(selesaiIso: String?): String? {
    if (selesaiIso == null) return null
    val waktu = runCatching { OffsetDateTime.parse(selesaiIso) }.getOrNull() ?: return null
    val wib = waktu.atZoneSameInstant(WIB)
    return "s.d. ${wib.dayOfMonth} ${NAMA_BULAN[wib.monthValue - 1]}"
}

/**
 * Kalimat syarat tanpa bagian "s.d. …" bila tanggal yang sama sudah tampil
 * di baris ber-ikon jam. Kalimatnya sendiri dibuat gateway dan identik
 * dengan pratinjau admin, jadi pemangkasan hanya terjadi di tampilan APK.
 */
fun syaratTanpaTanggal(kalimat: String, berlakuSampai: String?): String {
    if (berlakuSampai == null) return kalimat
    if (kalimat == berlakuSampai) return ""
    return kalimat.removeSuffix(" · $berlakuSampai")
}
