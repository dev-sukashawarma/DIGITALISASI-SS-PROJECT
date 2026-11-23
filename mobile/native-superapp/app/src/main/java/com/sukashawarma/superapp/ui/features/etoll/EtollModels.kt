package com.sukashawarma.superapp.ui.features.etoll

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class EtollChipTxPayload(
    @SerialName("tx_type") val txType: String, // "debit" | "topup"
    @SerialName("occurred_at") val occurredAt: String,
    val amount: Long,
    @SerialName("balance_after") val balanceAfter: Long? = null,
    @SerialName("terminal_code") val terminalCode: String? = null,
    @SerialName("raw_hex") val rawHex: String? = null
)

@Serializable
data class EtollScanRequest(
    @SerialName("card_number") val cardNumber: String,
    val issuer: String, // "mandiri_emoney" | "bca_flazz" | "bni_tapcash" | "bri_brizzi"
    val balance: Long,
    @SerialName("scanned_at") val scannedAt: String,
    @SerialName("gps_lat") val gpsLat: Double? = null,
    @SerialName("gps_lng") val gpsLng: Double? = null,
    @SerialName("device_info") val deviceInfo: String? = null,
    val transactions: List<EtollChipTxPayload> = emptyList(),
    @SerialName("raw_diagnostics") val rawDiagnostics: Map<String, String> = emptyMap()
)

@Serializable
data class EtollHolderDto(
    val id: String = "",
    val name: String = "",
    val role: String = ""
)

@Serializable
data class EtollCardDto(
    val id: String = "",
    @SerialName("card_number") val cardNumber: String = "",
    val issuer: String = "",
    val label: String = "",
    @SerialName("vehicle_plate") val vehiclePlate: String? = null,
    val division: String? = null,
    @SerialName("last_balance") val lastBalance: Long = 0,
    val holder: EtollHolderDto? = null
)

@Serializable
data class EtollTransactionDto(
    val id: String = "",
    @SerialName("tx_type") val txType: String = "debit",
    val source: String = "chip",
    @SerialName("occurred_at") val occurredAt: String = "",
    val amount: Long = 0,
    @SerialName("balance_after") val balanceAfter: Long? = null,
    @SerialName("terminal_code") val terminalCode: String? = null,
    @SerialName("merchant_label") val merchantLabel: String? = null,
    val category: String = "belum_dikategorikan",
    val note: String? = null
)

@Serializable
data class EtollScanResponse(
    val ok: Boolean = false,
    val error: String? = null,
    val code: String? = null,
    @SerialName("card_number") val cardNumber: String? = null,
    val issuer: String? = null,
    val balance: Long? = null,
    @SerialName("can_register") val canRegister: Boolean = false,
    val card: EtollCardDto? = null,
    @SerialName("new_transactions") val newTransactions: List<EtollTransactionDto> = emptyList(),
    @SerialName("untracked_gap_amount") val untrackedGapAmount: Long = 0,
    @SerialName("matched_topups_count") val matchedTopupsCount: Int = 0
)

@Serializable
data class EtollTagRequest(
    val category: String,
    val note: String? = null
)

@Serializable
data class EtollRegisterCardRequest(
    @SerialName("card_number") val cardNumber: String,
    val issuer: String,
    val label: String,
    val division: String? = null,
    @SerialName("vehicle_plate") val vehiclePlate: String? = null,
    @SerialName("initial_balance") val initialBalance: Long = 0
)

data class NfcReadCardResult(
    val cardNumber: String,
    val issuer: String,
    val balance: Long,
    val transactions: List<EtollChipTxPayload>,
    val rawDiagnostics: Map<String, String>
)

fun issuerDisplayName(issuer: String): String = when (issuer) {
    "mandiri_emoney" -> "Mandiri e-Money"
    "bca_flazz" -> "BCA Flazz"
    "bni_tapcash" -> "BNI TapCash"
    "bri_brizzi" -> "BRI Brizzi"
    else -> issuer
}

fun formatCardDigits(raw: String): String =
    raw.replace(Regex("[^0-9A-Za-z]"), "").uppercase().chunked(4).joinToString(" ")

fun formatRupiahId(amount: Long): String {
    val neg = amount < 0
    val absVal = kotlin.math.abs(amount)
    val str = absVal.toString().reversed().chunked(3).joinToString(".").reversed()
    return if (neg) "-Rp $str" else "Rp $str"
}
