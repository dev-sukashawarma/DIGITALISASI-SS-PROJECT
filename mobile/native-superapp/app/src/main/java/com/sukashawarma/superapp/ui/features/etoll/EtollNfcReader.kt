package com.sukashawarma.superapp.ui.features.etoll

import android.nfc.Tag
import android.nfc.tech.IsoDep
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Pembaca NFC ISO-DEP / APDU untuk 4 kartu e-Money / e-Toll utama Indonesia:
 * 1. Mandiri e-Money
 * 2. BCA Flazz (Gen 1 & Gen 2)
 * 3. BNI TapCash
 * 4. BRI Brizzi
 *
 * Seluruh respon APDU mentah juga disimpan di `rawDiagnostics` agar variasi
 * firmware seri kartu fisik dapat segera diaudit tanpa kehilangan data.
 */
object EtollNfcReader {

    // --- APDU Constants ---
    private val APDU_SELECT_MANDIRI = hexToBytes("00A40400080000000000000001")
    private val APDU_MANDIRI_CARD_INFO = hexToBytes("00B300003F")
    private val APDU_MANDIRI_BALANCE = hexToBytes("00B500000A")

    private val APDU_SELECT_FLAZZ_GEN2 = hexToBytes("00A404000BA0000000180F0000018001")
    private val APDU_SELECT_FLAZZ_GEN1 = hexToBytes("00A4040008A0000000180F0001")
    private val APDU_FLAZZ_CARD_NO = hexToBytes("00B0810010")
    private val APDU_FLAZZ_BALANCE = hexToBytes("903203000A")
    private val APDU_FLAZZ_BALANCE_ALT = hexToBytes("00B0820010")

    private val APDU_SELECT_TAPCASH = hexToBytes("00A4040008A000424E49100001")
    private val APDU_TAPCASH_PURSE_INFO = hexToBytes("9032030000")

    private val APDU_SELECT_BRIZZI = hexToBytes("00A4040006000000000003")
    private val APDU_BRIZZI_DESFIRE_APP = hexToBytes("905A00000301000000")
    private val APDU_BRIZZI_CARD_NO = hexToBytes("90BD0000070000000017000000")
    private val APDU_BRIZZI_BALANCE = hexToBytes("906C0000010100")

    fun readTag(tag: Tag): Result<NfcReadCardResult> {
        val isoDep = IsoDep.get(tag)
            ?: return Result.failure(
                IllegalArgumentException("Kartu tidak mendukung protokol ISO-DEP (bukan kartu e-Toll yang didukung).")
            )

        val uidHex = bytesToHex(tag.id ?: ByteArray(0))
        val diagnostics = linkedMapOf<String, String>("tag_uid" to uidHex)

        return try {
            isoDep.connect()
            isoDep.timeout = 4000

            tryMandiri(isoDep, diagnostics)?.let { return Result.success(it) }
            tryBcaFlazz(isoDep, diagnostics)?.let { return Result.success(it) }
            tryBniTapCash(isoDep, diagnostics)?.let { return Result.success(it) }
            tryBriBrizzi(isoDep, diagnostics)?.let { return Result.success(it) }

            Result.failure(
                IllegalStateException(
                    "Kartu tidak dikenali sebagai Mandiri e-Money, BCA Flazz, BNI TapCash, atau BRI Brizzi. Tempelkan kartu lebih stabil lalu coba lagi."
                )
            )
        } catch (e: Exception) {
            Result.failure(
                IllegalStateException("Gagal membaca chip NFC: ${e.message ?: "kartu terlepas terlalu cepat"}")
            )
        } finally {
            runCatching { isoDep.close() }
        }
    }

    private fun tryMandiri(isoDep: IsoDep, diag: MutableMap<String, String>): NfcReadCardResult? {
        val sel = transceiveSafe(isoDep, APDU_SELECT_MANDIRI) ?: return null
        if (!isSuccessSw(sel)) return null
        diag["mandiri_select"] = bytesToHex(sel)

        val infoResp = transceiveSafe(isoDep, APDU_MANDIRI_CARD_INFO) ?: return null
        val balResp = transceiveSafe(isoDep, APDU_MANDIRI_BALANCE) ?: return null
        diag["mandiri_info"] = bytesToHex(infoResp)
        diag["mandiri_balance"] = bytesToHex(balResp)

        if (!isSuccessSw(infoResp) || !isSuccessSw(balResp)) return null

        val cardNumber = parseMandiriCardNumber(stripSw(infoResp)) ?: return null
        val balance = parseMandiriBalance(stripSw(balResp)) ?: return null

        val txs = mutableListOf<EtollChipTxPayload>()
        for (rec in 1..10) {
            val cmd = byteArrayOf(0x00, 0xB2.toByte(), rec.toByte(), 0x04, 0x00)
            val resp = transceiveSafe(isoDep, cmd) ?: break
            if (!isSuccessSw(resp)) break
            val payload = stripSw(resp)
            if (payload.isEmpty() || payload.all { it == 0.toByte() }) continue
            diag["mandiri_rec_$rec"] = bytesToHex(payload)
            parseMandiriHistoryRecord(payload)?.let { txs.add(it) }
        }

        return NfcReadCardResult(
            cardNumber = cardNumber,
            issuer = "mandiri_emoney",
            balance = balance,
            transactions = txs,
            rawDiagnostics = diag
        )
    }

    private fun tryBcaFlazz(isoDep: IsoDep, diag: MutableMap<String, String>): NfcReadCardResult? {
        val sel2 = transceiveSafe(isoDep, APDU_SELECT_FLAZZ_GEN2)
        val sel1 = if (sel2 == null || !isSuccessSw(sel2)) transceiveSafe(isoDep, APDU_SELECT_FLAZZ_GEN1) else null
        val activeSel = when {
            sel2 != null && isSuccessSw(sel2) -> sel2
            sel1 != null && isSuccessSw(sel1) -> sel1
            else -> return null
        }
        diag["flazz_select"] = bytesToHex(activeSel)

        val cardResp = transceiveSafe(isoDep, APDU_FLAZZ_CARD_NO) ?: return null
        diag["flazz_card"] = bytesToHex(cardResp)
        if (!isSuccessSw(cardResp)) return null

        val balRespPrimary = transceiveSafe(isoDep, APDU_FLAZZ_BALANCE)
        val balResp = if (balRespPrimary != null && isSuccessSw(balRespPrimary)) {
            balRespPrimary
        } else {
            transceiveSafe(isoDep, APDU_FLAZZ_BALANCE_ALT)
        } ?: return null
        diag["flazz_balance"] = bytesToHex(balResp)
        if (!isSuccessSw(balResp)) return null

        val cardNumber = parseFlazzCardNumber(stripSw(cardResp)) ?: return null
        val balance = parseFlazzBalance(stripSw(balResp)) ?: return null

        val txs = mutableListOf<EtollChipTxPayload>()
        for (rec in 1..10) {
            val cmd = byteArrayOf(0x00, 0xB2.toByte(), rec.toByte(), 0x14, 0x00)
            val resp = transceiveSafe(isoDep, cmd) ?: break
            if (!isSuccessSw(resp)) break
            val payload = stripSw(resp)
            if (payload.isEmpty() || payload.all { it == 0.toByte() }) continue
            diag["flazz_rec_$rec"] = bytesToHex(payload)
            parseGenericHistoryRecord(payload)?.let { txs.add(it) }
        }

        return NfcReadCardResult(
            cardNumber = cardNumber,
            issuer = "bca_flazz",
            balance = balance,
            transactions = txs,
            rawDiagnostics = diag
        )
    }

    private fun tryBniTapCash(isoDep: IsoDep, diag: MutableMap<String, String>): NfcReadCardResult? {
        val sel = transceiveSafe(isoDep, APDU_SELECT_TAPCASH) ?: return null
        if (!isSuccessSw(sel)) return null
        diag["tapcash_select"] = bytesToHex(sel)

        val purseResp = transceiveSafe(isoDep, APDU_TAPCASH_PURSE_INFO) ?: return null
        diag["tapcash_purse"] = bytesToHex(purseResp)
        if (!isSuccessSw(purseResp)) return null

        val data = stripSw(purseResp)
        val parsed = parseTapCashPurseInfo(data) ?: return null

        val txs = mutableListOf<EtollChipTxPayload>()
        for (rec in 1..10) {
            val cmd = byteArrayOf(0x00, 0xB2.toByte(), rec.toByte(), 0x0C, 0x00)
            val resp = transceiveSafe(isoDep, cmd) ?: break
            if (!isSuccessSw(resp)) break
            val payload = stripSw(resp)
            if (payload.isEmpty() || payload.all { it == 0.toByte() }) continue
            diag["tapcash_rec_$rec"] = bytesToHex(payload)
            parseGenericHistoryRecord(payload)?.let { txs.add(it) }
        }

        return NfcReadCardResult(
            cardNumber = parsed.first,
            issuer = "bni_tapcash",
            balance = parsed.second,
            transactions = txs,
            rawDiagnostics = diag
        )
    }

    private fun tryBriBrizzi(isoDep: IsoDep, diag: MutableMap<String, String>): NfcReadCardResult? {
        val selIso = transceiveSafe(isoDep, APDU_SELECT_BRIZZI)
        val selDesfire = if (selIso == null || !isSuccessSw(selIso)) {
            transceiveSafe(isoDep, APDU_BRIZZI_DESFIRE_APP)
        } else null

        val selected = when {
            selIso != null && isSuccessSw(selIso) -> selIso
            selDesfire != null && isSuccessSw(selDesfire) -> selDesfire
            else -> return null
        }
        diag["brizzi_select"] = bytesToHex(selected)

        val cardResp = transceiveSafe(isoDep, APDU_BRIZZI_CARD_NO) ?: return null
        val balResp = transceiveSafe(isoDep, APDU_BRIZZI_BALANCE) ?: return null
        diag["brizzi_card"] = bytesToHex(cardResp)
        diag["brizzi_balance"] = bytesToHex(balResp)

        if (!isSuccessSw(cardResp) || !isSuccessSw(balResp)) return null

        val cardNumber = parseBrizziCardNumber(stripSw(cardResp)) ?: return null
        val balance = parseLittleEndianInt(stripSw(balResp), 0, 4) ?: return null

        // BRI Brizzi umumnya tidak membuka histori debit penuh lewat NFC publik;
        // deteksi selisih saldo di server akan otomatis melacak pengeluaran & top-up.
        return NfcReadCardResult(
            cardNumber = cardNumber,
            issuer = "bri_brizzi",
            balance = balance,
            transactions = emptyList(),
            rawDiagnostics = diag
        )
    }

    // --- Pure Parsers (internal untuk unit test) ---

    internal fun parseMandiriCardNumber(data: ByteArray): String? {
        if (data.size < 8) return null
        val hex = bytesToHex(data.copyOfRange(0, 8))
        return hex.takeIf { it.all { ch -> ch.isDigit() } && it.length == 16 }
    }

    internal fun parseMandiriBalance(data: ByteArray): Long? {
        if (data.size < 4) return null
        return parseLittleEndianInt(data, 0, 4)
    }

    /**
     * Parser record histori Mandiri e-Money.
     * Format umum 16-23 byte:
     * - Byte 0: jenis transaksi (0x01 / 0x02 = topup/isi ulang, lainnya = debit)
     * - Byte 1..4: timestamp detik sejak epoch Mandiri (2000-01-01 00:00:00 WIB) atau BCD DDMMYY HHMMSS
     * - Byte 5..8: nominal (4-byte little-endian) atau 3-byte big-endian
     * - Byte 9..12: saldo setelah transaksi (jika tersedia)
     * - Sisa byte: kode terminal/merchant hex
     */
    internal fun parseMandiriHistoryRecord(data: ByteArray): EtollChipTxPayload? {
        if (data.size < 12) return null
        val rawHex = bytesToHex(data)
        val txTypeCode = data[0].toInt() and 0xFF
        val txType = if (txTypeCode == 0x01 || txTypeCode == 0x02 || txTypeCode == 0x0A) "topup" else "debit"

        // Coba baca nominal 4-byte LE di offset 5..8 (rentang wajar Rp 100 .. Rp 20.000.000)
        val amtLe = parseLittleEndianInt(data, 5, 4)
        val amtBe3 = parseBigEndianInt(data, 4, 3)
        val amount = when {
            amtLe != null && amtLe in 100L..20_000_000L -> amtLe
            amtBe3 != null && amtBe3 in 100L..20_000_000L -> amtBe3
            else -> return null
        }

        val balAfterCandidate = if (data.size >= 13) parseLittleEndianInt(data, 9, 4) else null
        val balanceAfter = balAfterCandidate?.takeIf { it in 0L..20_000_000L }

        val occurredAt = parseEpoch2000OrFallback(data, 1)
        val terminalCode = if (data.size >= 16) {
            bytesToHex(data.copyOfRange(13, minOf(data.size, 17)))
        } else null

        return EtollChipTxPayload(
            txType = txType,
            occurredAt = occurredAt,
            amount = amount,
            balanceAfter = balanceAfter,
            terminalCode = terminalCode?.takeIf { it.any { c -> c != '0' } },
            rawHex = rawHex
        )
    }

    internal fun parseFlazzCardNumber(data: ByteArray): String? {
        if (data.size < 8) return null
        // Flazz sering menyimpan 16 digit ASCII atau 8 byte BCD
        val ascii = String(data, Charsets.US_ASCII).filter { it.isDigit() }
        if (ascii.length >= 16) return ascii.substring(0, 16)
        val bcd = bytesToHex(data).filter { it.isDigit() }
        return if (bcd.length >= 16) bcd.substring(0, 16) else null
    }

    internal fun parseFlazzBalance(data: ByteArray): Long? {
        if (data.size < 3) return null
        // 3-byte big-endian (atau 4-byte) dalam batas saldo maksimal e-Money Rp 20 juta
        val b3 = parseBigEndianInt(data, 0, 3)
        if (b3 != null && b3 in 0L..20_000_000L) return b3
        if (data.size >= 4) {
            val b4 = parseBigEndianInt(data, 0, 4)
            if (b4 != null && b4 in 0L..20_000_000L) return b4
        }
        return null
    }

    internal fun parseTapCashPurseInfo(data: ByteArray): Pair<String, Long>? {
        if (data.size < 16) return null
        // TapCash Purse Info: saldo 3-byte big-endian di bytes 2..4, nomor kartu 8-byte BCD di bytes 8..15
        val balance = parseBigEndianInt(data, 2, 3) ?: return null
        val cardHex = bytesToHex(data.copyOfRange(8, 16))
        if (!cardHex.all { it.isDigit() }) return null
        return cardHex to balance
    }

    internal fun parseBrizziCardNumber(data: ByteArray): String? {
        if (data.size < 11) return null
        // Brizzi DESFire file 0x00: 8-byte BCD card number dimulai offset 3..10 (atau 0..7)
        val slice3 = bytesToHex(data.copyOfRange(3, 11))
        if (slice3.all { it.isDigit() } && slice3.length == 16) return slice3
        val slice0 = bytesToHex(data.copyOfRange(0, 8))
        if (slice0.all { it.isDigit() } && slice0.length == 16) return slice0
        return null
    }

    internal fun parseGenericHistoryRecord(data: ByteArray): EtollChipTxPayload? {
        if (data.size < 10) return null
        val rawHex = bytesToHex(data)
        val typeByte = data[0].toInt() and 0xFF
        val txType = if (typeByte == 0x01 || typeByte == 0x02) "topup" else "debit"
        val amount = parseBigEndianInt(data, 1, 3)?.takeIf { it in 100L..20_000_000L } ?: return null
        val terminalCode = if (data.size >= 12) {
            bytesToHex(data.copyOfRange(8, minOf(data.size, 12)))
        } else null

        return EtollChipTxPayload(
            txType = txType,
            occurredAt = parseEpoch2000OrFallback(data, 4),
            amount = amount,
            balanceAfter = null,
            terminalCode = terminalCode?.takeIf { it.any { c -> c != '0' } },
            rawHex = rawHex
        )
    }

    private fun parseEpoch2000OrFallback(data: ByteArray, offset: Int): String {
        val isoFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'+07:00'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("Asia/Jakarta")
        }
        if (data.size >= offset + 4) {
            val sec = parseBigEndianInt(data, offset, 4) ?: 0L
            // Epoch 2000-01-01 00:00:00 WIB -> cek apakah jatuh pada tahun wajar 2020..2035
            val base2000 = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta")).apply {
                set(2000, Calendar.JANUARY, 1, 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            val candidateMs = base2000 + sec * 1000L
            val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta")).apply {
                timeInMillis = candidateMs
            }
            val yr = cal.get(Calendar.YEAR)
            if (yr in 2020..2035) {
                return isoFmt.format(cal.time)
            }
        }
        return isoFmt.format(Calendar.getInstance(TimeZone.getTimeZone("Asia/Jakarta")).time)
    }

    private fun transceiveSafe(isoDep: IsoDep, cmd: ByteArray): ByteArray? =
        runCatching { isoDep.transceive(cmd) }.getOrNull()

    internal fun isSuccessSw(resp: ByteArray): Boolean {
        if (resp.size < 2) return false
        val sw1 = resp[resp.size - 2].toInt() and 0xFF
        val sw2 = resp[resp.size - 1].toInt() and 0xFF
        return (sw1 == 0x90 && sw2 == 0x00) || (sw1 == 0x91 && sw2 == 0x00)
    }

    internal fun stripSw(resp: ByteArray): ByteArray =
        if (resp.size >= 2) resp.copyOfRange(0, resp.size - 2) else ByteArray(0)

    internal fun parseLittleEndianInt(data: ByteArray, offset: Int, len: Int): Long? {
        if (offset < 0 || offset + len > data.size) return null
        var value = 0L
        for (i in 0 until len) {
            value = value or ((data[offset + i].toLong() and 0xFFL) shl (8 * i))
        }
        return value
    }

    internal fun parseBigEndianInt(data: ByteArray, offset: Int, len: Int): Long? {
        if (offset < 0 || offset + len > data.size) return null
        var value = 0L
        for (i in 0 until len) {
            value = (value shl 8) or (data[offset + i].toLong() and 0xFFL)
        }
        return value
    }

    internal fun hexToBytes(hex: String): ByteArray {
        val clean = hex.replace(" ", "")
        return ByteArray(clean.length / 2) { i ->
            clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }

    internal fun bytesToHex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02X".format(it.toInt() and 0xFF) }
}
