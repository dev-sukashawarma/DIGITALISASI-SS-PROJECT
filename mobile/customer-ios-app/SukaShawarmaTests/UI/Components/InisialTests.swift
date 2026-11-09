import Testing
@testable import SukaShawarma

/// Porting `InisialTest.kt` (5/5).
struct InisialTests {
    @Test func duaKataPertama() {
        #expect(inisialNama("developer sukashawarma") == "DS")
        #expect(inisialNama("Andi Budi Cahyo") == "AB")
    }
    @Test func satuKataSatuHuruf() { #expect(inisialNama("andi") == "A") }
    @Test func spasiBerlebih() { #expect(inisialNama("  andi    budi  ") == "AB") }
    @Test func namaKosongJatuhKeEmail() {
        #expect(inisialNama(nil, email: "dev@contoh.com") == "D")
        #expect(inisialNama("   ", email: "dev@contoh.com") == "D")
    }
    @Test func tanpaNamaDanEmailTakMenebak() { #expect(inisialNama(nil, email: nil) == "?") }
}
