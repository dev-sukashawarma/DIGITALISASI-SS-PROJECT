import Foundation
import Testing
@testable import SukaShawarma

private func luminansi(_ rgb: UInt32) -> Double {
    func kanal(_ c: UInt32) -> Double {
        let s = Double(c) / 255
        return s <= 0.03928 ? s / 12.92 : pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * kanal((rgb >> 16) & 0xFF) + 0.7152 * kanal((rgb >> 8) & 0xFF) + 0.0722 * kanal(rgb & 0xFF)
}

func kontras(_ a: UInt32, _ b: UInt32) -> Double {
    let la = luminansi(a), lb = luminansi(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

/// Porting `ColorContrastTest.kt` (4/4) + kombinasi yang BENAR-BENAR dipakai
/// layar iOS. Nilai heksa ditulis ulang di sini dengan sengaja: bila seseorang
/// mengubah `SukaColors.swift`, uji ini memaksanya memeriksa ulang kontras.
struct ColorContrastTests {
    let brown: UInt32 = 0x701604, orange: UInt32 = 0xF29744, ink: UInt32 = 0x400A07
    let putih: UInt32 = 0xFFFFFF, cream: UInt32 = 0xFFF7ED, tint: UInt32 = 0xFDF0E2
    let muted: UInt32 = 0x826754, body: UInt32 = 0x6B5548, green: UInt32 = 0x0A7D2C
    let orangeTeks: UInt32 = 0xA8560B, merah: UInt32 = 0xD32222

    // — Dari Android —
    @Test func coklatDenganTeksPutihAAA() { #expect(kontras(brown, putih) >= 7) }
    @Test func oranyeDenganTeksInkAAA() { #expect(kontras(orange, ink) >= 7) }
    @Test func teksPutihDiAtasOranyeDilarang() {
        // Kalau ini lulus, seseorang mengubah palet. Teks putih di atas oranye
        // tidak terbaca di bawah matahari.
        #expect(kontras(orange, putih) < 4.5)
    }
    @Test func inkDiAtasKremAAA() { #expect(kontras(cream, ink) >= 7) }

    // — Tambahan iOS: semua teks kecil harus ≥ 4,5:1 (WCAG AA) —
    @Test func teksSekunderLulusAADiSemuaLatarTerang() {
        for latar in [putih, cream, tint] {
            #expect(kontras(muted, latar) >= 4.5)
            #expect(kontras(body, latar) >= 4.5)
            #expect(kontras(orangeTeks, latar) >= 4.5)
        }
    }
    @Test func oranyeAsliTakBolehJadiTeksDiLatarTerang() {
        #expect(kontras(orange, putih) < 4.5)  // itu sebabnya ada sukaOrangeTeks
    }
    @Test func teksDiAtasKepalaCoklat() {
        #expect(kontras(orange, brown) >= 4.5)      // subjudul kepala
        #expect(kontras(0xFFF4EB, brown) >= 7)      // judul kepala
    }
    @Test func warnaStatus() {
        #expect(kontras(green, putih) >= 4.5)
        #expect(kontras(green, 0xECFDF5) >= 4.5)
        #expect(kontras(merah, 0xFEF2F2) >= 4.5)
        #expect(kontras(0x92400E, 0xFEF3C7) >= 4.5)  // kartu masalah checkout
        #expect(kontras(0x991B1B, 0xFEE2E2) >= 4.5)  // pesan penolakan checkout
    }
}
