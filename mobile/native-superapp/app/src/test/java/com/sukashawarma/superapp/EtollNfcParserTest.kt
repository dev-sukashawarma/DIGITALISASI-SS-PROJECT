package com.sukashawarma.superapp

import com.sukashawarma.superapp.ui.features.etoll.EtollNfcReader
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EtollNfcParserTest {

    @Test
    fun parseMandiriCardNumberAndBalance() {
        val cardInfo = EtollNfcReader.hexToBytes("603298201234567800000000")
        assertEquals("6032982012345678", EtollNfcReader.parseMandiriCardNumber(cardInfo))

        // Rp 150.000 = 0x000249F0 -> little endian: F0 49 02 00
        val balBytes = EtollNfcReader.hexToBytes("F0490200000000000000")
        assertEquals(150_000L, EtollNfcReader.parseMandiriBalance(balBytes))
    }

    @Test
    fun parseFlazzCardNumberAndBalance() {
        // ASCII 16 digits
        val asciiCard = "0145123456789012".toByteArray(Charsets.US_ASCII)
        assertEquals("0145123456789012", EtollNfcReader.parseFlazzCardNumber(asciiCard))

        // 3-byte big-endian Rp 75.500 = 0x0126EC
        val balBytes = EtollNfcReader.hexToBytes("0126EC0000")
        assertEquals(75_500L, EtollNfcReader.parseFlazzBalance(balBytes))
    }

    @Test
    fun parseTapCashPurseInfo() {
        // Bytes 0..1 header, 2..4 balance (Rp 200.000 = 0x030D40), 5..7 pad, 8..15 card number BCD
        val purse = EtollNfcReader.hexToBytes("0000030D400000007546123456789012")
        val parsed = EtollNfcReader.parseTapCashPurseInfo(purse)
        assertNotNull(parsed)
        assertEquals("7546123456789012", parsed!!.first)
        assertEquals(200_000L, parsed.second)
    }

    @Test
    fun parseBrizziCardNumberAndBalance() {
        val file0 = EtollNfcReader.hexToBytes("00000060135001234567890000")
        assertEquals("6013500123456789", EtollNfcReader.parseBrizziCardNumber(file0))

        // Rp 50.000 = 0x0000C350 -> LE 50 C3 00 00
        val bal = EtollNfcReader.hexToBytes("50C30000")
        assertEquals(50_000L, EtollNfcReader.parseLittleEndianInt(bal, 0, 4))
    }

    @Test
    fun statusWordValidationWorks() {
        assertTrue(EtollNfcReader.isSuccessSw(EtollNfcReader.hexToBytes("01029000")))
        assertTrue(EtollNfcReader.isSuccessSw(EtollNfcReader.hexToBytes("01029100")))
    }
}
