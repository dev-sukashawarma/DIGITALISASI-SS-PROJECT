import Testing
@testable import SukaShawarma

/// Porting `UraiWaktuIsoTest.kt` + `SesiBerlakuTest.kt`. Bentuk-bentuk di
/// bawah DISALIN dari balasan produksi, bukan dikarang.
struct UraiWaktuIsoTests {
    @Test func bentukZDariToISOString() {
        #expect(uraiWaktuIso("2026-09-07T03:23:34.097Z") == 1_788_751_414_097)
    }

    @Test func bentukBerOffsetMenghasilkanWaktuSama() {
        #expect(uraiWaktuIso("2026-09-07T03:23:34.097Z") == uraiWaktuIso("2026-09-07T10:23:34.097+07:00"))
    }

    @Test func mikrodetikEnamDigitDiterima() {
        #expect(uraiWaktuIso("2026-09-07T10:08:34.123577+07:00") == uraiWaktuIso("2026-09-07T10:08:34.123+07:00"))
        #expect(uraiWaktuIso("2026-09-07T10:08:34.123577+07:00") != nil)
    }

    @Test func tanpaPecahanDetik() {
        #expect(uraiWaktuIso("2026-09-07T03:23:34.000Z") == uraiWaktuIso("2026-09-07T03:23:34Z"))
    }

    @Test func offsetNegatif() {
        #expect(uraiWaktuIso("2026-09-07T03:23:34.097Z") == uraiWaktuIso("2026-09-06T22:23:34.097-05:00"))
    }

    @Test func offsetTanpaTitikDua() {
        #expect(uraiWaktuIso("2026-09-07T10:23:34.097+07:00") == uraiWaktuIso("2026-09-07T10:23:34.097+0700"))
    }

    @Test func stringSampahNil() {
        #expect(uraiWaktuIso("entah apa ini") == nil)
        #expect(uraiWaktuIso("") == nil)
        #expect(uraiWaktuIso("2026-09-07") == nil)
    }

    @Test func tanggalTakMasukAkalDitolak() {
        #expect(uraiWaktuIso("2026-13-45T99:99:99Z") == nil)
    }
}

struct SesiBerlakuTests {
    /// 2026-09-05T00:00:00.000Z dalam milidetik epoch.
    private let awalSeptember: Int64 = 1_788_566_400_000

    @Test func menguraiFormatGateway() {
        #expect(uraiWaktuIso("2026-09-05T00:00:00.000Z") == awalSeptember)
    }

    @Test func belumKedaluwarsaBerlaku() {
        #expect(sesiMasihBerlaku("2026-10-05T00:00:00.000Z", sekarang: awalSeptember))
    }

    @Test func sudahLewatTidakBerlaku() {
        #expect(!sesiMasihBerlaku("2026-08-05T00:00:00.000Z", sekarang: awalSeptember))
    }

    @Test func tanpaSesiTidakBerlaku() {
        #expect(!sesiMasihBerlaku(nil, sekarang: awalSeptember))
    }

    @Test func takBisaDiuraiDianggapMasihBerlaku() {
        #expect(sesiMasihBerlaku("entah apa ini", sekarang: awalSeptember))
        #expect(sesiMasihBerlaku("", sekarang: awalSeptember))
    }
}
