import Testing
@testable import SukaShawarma

/// Porting `JarakOutletTest.kt` (11/11).
struct JarakOutletTests {
    // Koordinat nyata dua kota yang jaraknya diketahui, bukan angka karangan.
    private let bogor = Koordinat(lat: -6.5971, lng: 106.8060)
    private let depok = Koordinat(lat: -6.4025, lng: 106.7942)

    private func outlet(_ id: String, _ nama: String, _ k: Koordinat? = nil, lat: Double? = nil,
                        aktif: Bool = true) -> OutletDto {
        OutletDto(id: id, name: nama, address: nil, lat: k?.lat ?? lat, lng: k?.lng, isActive: aktif)
    }

    @Test func bogorKeDepokSekitar21Km() { #expect(abs(jarakMeter(bogor, depok) - 21_600) < 500) }
    @Test func titikKeDirinyaNol() { #expect(abs(jarakMeter(bogor, bogor)) < 0.001) }

    @Test func tanpaKoordinatTakPunyaJarak() {
        #expect(jarakOutlet(outlet("a", "A"), bogor) == nil)
        #expect(jarakOutlet(outlet("a", "A", lat: -6.5), bogor) == nil)
    }

    @Test func denganPosisiTerdekatDiAtas() {
        let h = urutkanOutlet([outlet("depok", "Aaa Depok", depok), outlet("bogor", "Zzz Bogor", bogor)], posisi: bogor)
        #expect(h.map(\.id) == ["bogor", "depok"])
    }

    @Test func denganPosisiTanpaKoordinatDiBawahAlfabetis() {
        let h = urutkanOutlet([outlet("z", "Zeta"), outlet("a", "Alfa"), outlet("depok", "Depok", depok)], posisi: bogor)
        #expect(h.map(\.id) == ["depok", "a", "z"])
    }

    @Test func denganPosisiBukaTetapDiAtas() {
        let h = urutkanOutlet([outlet("tutup-dekat", "Dekat", bogor, aktif: false), outlet("buka-jauh", "Jauh", depok)],
                              posisi: bogor)
        #expect(h.map(\.id) == ["buka-jauh", "tutup-dekat"])
    }

    @Test func tanpaPosisiAlfabetis() {
        let h = urutkanOutlet([outlet("z", "Zeta", bogor), outlet("a", "Alfa", depok)], posisi: nil)
        #expect(h.map(\.id) == ["a", "z"])
    }

    @Test func otomatisPilihTerdekat() {
        let h = pilihOutletTerdekat([outlet("depok", "Depok", depok), outlet("bogor", "Bogor", bogor)], posisi: bogor)
        #expect(h?.id == "bogor")
    }
    @Test func otomatisPilihLewatiTanpaKoordinat() {
        // "Aaa" tanpa koordinat akan di urutan pertama bila ikut dihitung.
        let h = pilihOutletTerdekat([outlet("a", "Aaa"), outlet("depok", "Depok", depok)], posisi: bogor)
        #expect(h?.id == "depok")
    }
    @Test func otomatisPilihNilBilaTakAdaKoordinat() {
        #expect(pilihOutletTerdekat([outlet("a", "A"), outlet("b", "B")], posisi: bogor) == nil)
    }
    @Test func otomatisPilihUtamakanAktif() {
        let h = pilihOutletTerdekat([outlet("dekat", "Dekat", bogor, aktif: false), outlet("jauh", "Jauh", depok)],
                                    posisi: bogor)
        #expect(h?.id == "jauh")
    }

    @Test func labelMeterDibulatkanPuluhan() {
        #expect(labelJarak(847) == "850 m")
        #expect(labelJarak(3) == "10 m")
    }

    @Test func labelKilometerKomaDesimal() {
        #expect(labelJarak(1_234) == "1,2 km")
        #expect(labelJarak(21_580) == "21,6 km")
    }

    @Test func labelJauhTanpaDesimal() { #expect(labelJarak(124_600) == "125 km") }
    @Test func pembulatanKe1000MeterJadiKilometer() { #expect(labelJarak(996) == "1,0 km") }
}

/// Porting `StatusOutletLabelTest.kt` (5/5).
struct StatusOutletLabelTests {
    private func o(_ bisa: Bool?, aktif: Bool = true, pesan: String? = nil, terakhir: String? = nil) -> OutletDto {
        OutletDto(id: "a", name: "A", isActive: aktif, bisaPesan: bisa, pesanStatus: pesan, pesanTerakhir: terakhir)
    }

    @Test func gatewayLamaJatuhKeIsActive() {
        #expect(o(nil, aktif: true).bolehPesan)
        #expect(!o(nil, aktif: false).bolehPesan)
    }
    @Test func bisaPesanFalseMenang() { #expect(!o(false, aktif: true).bolehPesan) }
    @Test func labelBukaMenyebutPesanTerakhirWib() {
        #expect(labelStatusOutlet(o(true, terakhir: "2026-09-24T14:30:00.000Z")) == "Buka · pesan terakhir 21.30")
    }
    @Test func labelTutupPakaiKalimatGateway() {
        #expect(labelStatusOutlet(o(false, pesan: "Outlet belum buka. Buka pukul 14.00.")) == "Outlet belum buka. Buka pukul 14.00.")
    }
    @Test func tutupTanpaKalimatGateway() { #expect(labelStatusOutlet(o(false)) == "Tutup") }
    @Test func keteranganTutupNilBilaBisaPesan() {
        #expect(labelOutletTutup(o(true)) == nil)
        #expect(labelOutletTutup(nil) == nil)
        #expect(labelOutletTutup(o(false)) == "Tutup")
    }
}
