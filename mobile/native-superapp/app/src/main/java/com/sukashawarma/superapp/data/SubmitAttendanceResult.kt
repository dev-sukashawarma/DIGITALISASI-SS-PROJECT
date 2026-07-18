package com.sukashawarma.superapp.data

import kotlinx.serialization.Serializable

@Serializable
data class SubmitAttendanceResponse(
    val ok: Boolean,
    val reason: String? = null,
    val status: String? = null
)

/** Map kode reason endpoint web → pesan user Indonesia. Pure function — unit-tested. */
object SubmitFailureMessages {
    fun forReason(reason: String?): String = when {
        reason == null -> "Gagal mengirim absensi (tanpa keterangan)."
        reason == "not_enrolled" -> "Wajah belum terdaftar di sistem absensi web. Hubungi SPV — sementara ini absen HP butuh enrollment web."
        reason == "shift_not_closed" -> "Shift kasir outlet masih terbuka — tutup shift dulu sebelum absen pulang."
        reason == "too_early_in" -> "Belum waktunya absen masuk."
        reason == "too_early_out" -> "Belum waktunya absen pulang."
        reason == "gps_accuracy_low" -> "Akurasi GPS terlalu rendah — aktifkan Lokasi Akurat lalu coba lagi."
        reason.startsWith("too_far_from_outlet") -> "Kamu di luar radius outlet. ${reason.substringAfter(":", "").trim()}"
        reason == "cross_outlet" -> "Akun ini tidak terdaftar di outlet tersebut."
        reason == "staff_not_found" -> "Profil staff tidak ditemukan."
        reason == "outlet_not_found" -> "Data outlet tidak ditemukan."
        reason == "config_missing" -> "Konfigurasi jam absensi belum diatur — hubungi admin."
        reason == "insert_failed" -> "Gagal menyimpan absensi di server. Coba lagi."
        reason == "internal_error" -> "Terjadi kesalahan server. Coba lagi."
        else -> "Absensi ditolak: $reason"
    }
}
