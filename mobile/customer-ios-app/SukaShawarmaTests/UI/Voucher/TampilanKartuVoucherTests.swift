import Foundation
import Testing
@testable import SukaShawarma

/// Porting `TampilanKartuVoucherTest.kt` (6/6), plus kontrak `label_nilai`/`label_sub`.
struct TampilanKartuVoucherTests {
    private func v(jenis: String = "nominal", status: String = "berlaku", labelNilai: String? = "Rp5rb",
                   labelSub: String? = "potongan", selesai: String? = nil) -> VoucherDto {
        VoucherDto(id: "v1", nama: "Uji", jenis: jenis, kalimatSyarat: "Potongan Rp5.000", selesai: selesai,
                   status: status, labelNilai: labelNilai, labelSub: labelSub)
    }

    @Test func nilaiDariGatewayDipakaiApaAdanya() {
        #expect(nilaiKartu(v()) == ("Rp5rb", "potongan"))
    }

    @Test func gatewayLamaTanpaLabelTetapPunyaTeks() {
        #expect(nilaiKartu(v(jenis: "persen", labelNilai: nil, labelSub: nil)) == ("%", "potongan"))
        #expect(nilaiKartu(v(jenis: "gratis_item", labelNilai: nil, labelSub: nil)) == ("Gratis", "voucher"))
        #expect(nilaiKartu(v(jenis: "jenis_baru", labelNilai: nil, labelSub: nil)) == ("Promo", "voucher"))
    }

    @Test func warnaIkutJenisPudarBilaBelumBerlaku() {
        #expect(warnaKartu(v(jenis: "nominal")) == .oranye)
        #expect(warnaKartu(v(jenis: "harga_spesial")) == .oranye)
        #expect(warnaKartu(v(jenis: "persen")) == .cokelat)
        #expect(warnaKartu(v(jenis: "gratis_item")) == .hijau)
        #expect(warnaKartu(v(jenis: "beli_x_gratis_y")) == .hijau)
        #expect(warnaKartu(v(jenis: "gratis_item", status: "belum")) == .pudar)
    }

    @Test func masaBerlakuDibacaDalamWib() {
        // 30 Sep 16:59:59 UTC = 30 Sep 23:59:59 WIB
        #expect(labelBerlakuSampai("2026-09-30T16:59:59+00:00") == "s.d. 30 Sep")
        // 30 Sep 18:00 UTC = 1 Okt 01:00 WIB
        #expect(labelBerlakuSampai("2026-09-30T18:00:00Z") == "s.d. 1 Okt")
        #expect(labelBerlakuSampai("2026-09-30T08:50:00+07:00") == "s.d. 30 Sep")
    }

    @Test func tanpaTanggalAtauRusakTakTampil() {
        #expect(labelBerlakuSampai(nil) == nil)
        #expect(labelBerlakuSampai("bukan-tanggal") == nil)
    }

    @Test func tanggalTakDiulangDiKalimatSyarat() {
        #expect(syaratTanpaTanggal("Potongan Rp5.000 · s.d. 30 Sep", berlakuSampai: "s.d. 30 Sep") == "Potongan Rp5.000")
        #expect(syaratTanpaTanggal("s.d. 30 Sep", berlakuSampai: "s.d. 30 Sep") == "")
        #expect(syaratTanpaTanggal("Potongan Rp5.000 · s.d. 30 Sep", berlakuSampai: "s.d. 1 Okt") == "Potongan Rp5.000 · s.d. 30 Sep")
        #expect(syaratTanpaTanggal("Potongan Rp5.000", berlakuSampai: nil) == "Potongan Rp5.000")
    }

    @Test func labelNilaiTerurai() throws {
        let d = try JSONDecoder().decode(VoucherDto.self, from: Data(#"""
        {"id":"v1","nama":"Uji","jenis":"nominal","kalimat_syarat":"x","status":"berlaku","label_nilai":"Rp5rb","label_sub":"potongan"}
        """#.utf8))
        #expect(d.labelNilai == "Rp5rb" && d.labelSub == "potongan")
    }
}
