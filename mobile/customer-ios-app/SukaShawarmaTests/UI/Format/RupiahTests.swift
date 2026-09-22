import Testing
@testable import SukaShawarma

/// Porting `RupiahTest.kt`.
struct RupiahTests {
    @Test func titikSebagaiPemisahRibuan() {
        #expect(rupiah(Int64(25_000)) == "Rp25.000")
        #expect(rupiah(Int64(1_250_000)) == "Rp1.250.000")
    }

    @Test func dibawahSeribuTanpaPemisah() {
        #expect(rupiah(Int64(0)) == "Rp0")
        #expect(rupiah(Int64(999)) == "Rp999")
    }

    @Test func membulatkanPecahanKeRupiahPenuh() {
        #expect(rupiah(24_999.9999) == "Rp25.000")
        #expect(rupiah(15_000.5) == "Rp15.001")
    }

    @Test func negatifMemakaiMinusSebelumRp() {
        #expect(rupiah(Int64(-5_000)) == "-Rp5.000")
    }
}
