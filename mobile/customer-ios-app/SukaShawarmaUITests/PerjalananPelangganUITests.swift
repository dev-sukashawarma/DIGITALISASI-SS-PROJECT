import XCTest

/// Perjalanan pelanggan Fase 2 di gateway produksi: Beranda → Menu → Detail →
/// tambah ke keranjang → pil keranjang muncul → Pilih Outlet. Setiap langkah
/// menyimpan tangkapan layar di hasil uji (xcresult) untuk dibandingkan dengan
/// aplikasi Android.
///
/// Bergantung pada data produksi (minimal satu outlet `app_enabled` dengan
/// satu menu tersedia). Gagal di sini bisa berarti data berubah, bukan kode rusak.
@MainActor
final class PerjalananPelangganUITests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        continueAfterFailure = false
    }

    /// Menunggu splash + katalog, menutup popup promo bila ada.
    private func bukaAplikasi(skenario: String? = nil) {
        if let skenario { app.launchArguments += ["-skenarioUji", skenario] }
        app.launch()
        // Popup promo bersifat modal: selama tampil, bilah bawah memang
        // tersembunyi dari aksesibilitas. Tunggu salah satunya.
        let tabMenu = app.buttons["tab-menu"]
        let nantiSaja = app.buttons["Nanti Saja"]
        let muncul = NSPredicate { _, _ in tabMenu.exists || nantiSaja.exists }
        expectation(for: muncul, evaluatedWith: nil)
        waitForExpectations(timeout: 40)
        sleep(2)
    }

    /// Menu → menu pertama yang tersedia → tambah ke keranjang → buka keranjang.
    private func tambahMenuPertamaLaluBukaKeranjang() {
        let nantiSaja = app.buttons["Nanti Saja"]
        if nantiSaja.exists { nantiSaja.tap(); sleep(1) }
        app.buttons["tab-menu"].tap()
        let kartu = app.buttons["kartu-menu"].firstMatch
        XCTAssertTrue(kartu.waitForExistence(timeout: 10))
        kartu.tap()
        let tambah = app.buttons["tombol-tambah-keranjang"]
        XCTAssertTrue(tambah.waitForExistence(timeout: 5))
        tambah.tap()
        let bilah = app.buttons["bilah-keranjang"]
        XCTAssertTrue(bilah.waitForExistence(timeout: 5))
        bilah.tap()
        XCTAssertTrue(app.buttons["tombol-lanjut-bayar"].waitForExistence(timeout: 5))
    }

    /// Checkout dengan validasi gateway yang dipalsukan (lihat SkenarioUji.swift):
    /// penolakan harga berubah → "Pakai harga baru" → lolos → tombol bayar aktif.
    func testKeranjangSampaiCheckout() {
        bukaAplikasi(skenario: "checkout-masalah")
        tambahMenuPertamaLaluBukaKeranjang()
        sleep(1)
        jepret("07-keranjang")

        app.buttons["tombol-lanjut-bayar"].tap()
        let pakaiHargaBaru = app.buttons["Pakai harga baru"]
        XCTAssertTrue(pakaiHargaBaru.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["tombol-bayar"].isEnabled)
        jepret("08-checkout-harga-berubah")

        pakaiHargaBaru.tap()
        let bayar = app.buttons["tombol-bayar"]
        XCTAssertTrue(bayar.waitForExistence(timeout: 10))
        let aktif = NSPredicate(format: "isEnabled == true")
        expectation(for: aktif, evaluatedWith: bayar)
        waitForExpectations(timeout: 10)
        sleep(1)
        jepret("09-checkout-lolos")
    }

    /// Checkout → QRIS digambar → gateway (palsu) mengonfirmasi → layar sukses
    /// dengan nomor antrean 42 → keranjang kosong. Tak ada tagihan sungguhan.
    func testBayarSampaiSukses() {
        bukaAplikasi(skenario: "checkout-ok")
        tambahMenuPertamaLaluBukaKeranjang()
        app.buttons["tombol-lanjut-bayar"].tap()
        let bayar = app.buttons["tombol-bayar"]
        XCTAssertTrue(bayar.waitForExistence(timeout: 10))
        expectation(for: NSPredicate(format: "isEnabled == true"), evaluatedWith: bayar)
        waitForExpectations(timeout: 10)
        bayar.tap()

        XCTAssertTrue(app.descendants(matching: .any)["kartu-qris"].waitForExistence(timeout: 10))
        sleep(1)
        jepret("13-menunggu-pembayaran")

        let nomor = app.staticTexts["nomor-pesanan"]
        XCTAssertTrue(nomor.waitForExistence(timeout: 20))
        XCTAssertEqual(nomor.label, "42")
        sleep(1)
        jepret("14-pesanan-berhasil")

        app.buttons["Kembali ke Menu"].tap()
        XCTAssertTrue(app.buttons["tab-menu"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["bilah-keranjang"].exists)  // keranjang dikosongkan
    }

    /// Riwayat (4 keadaan) → status pesanan → notifikasi → profil, dengan data palsu SkenarioUji.
    func testRiwayatStatusNotifikasiProfil() {
        bukaAplikasi(skenario: "checkout-ok")
        let nantiSaja = app.buttons["Nanti Saja"]
        if nantiSaja.exists { nantiSaja.tap(); sleep(1) }

        app.buttons["tab-pesanan"].tap()
        XCTAssertTrue(app.staticTexts["Pesanan #40"].waitForExistence(timeout: 10))
        sleep(1)
        jepret("15-riwayat")

        app.staticTexts["#43"].tap()
        XCTAssertTrue(app.staticTexts["judul-status"].waitForExistence(timeout: 10))
        sleep(1)
        jepret("16-status-pesanan")
        app.buttons["Kembali"].firstMatch.tap()

        app.buttons["tab-beranda"].tap()
        let lonceng = app.buttons["tombol-notifikasi"]
        XCTAssertTrue(lonceng.waitForExistence(timeout: 5))
        lonceng.tap()
        XCTAssertTrue(app.staticTexts["Pesanan Sedang Dibuat"].waitForExistence(timeout: 10))
        sleep(1)
        jepret("17-notifikasi")
        app.buttons["Kembali"].firstMatch.tap()

        app.buttons["tab-profil"].tap()
        XCTAssertTrue(app.buttons["menu-Informasi Akun"].waitForExistence(timeout: 5))
        sleep(2)
        jepret("18-profil")
    }

    /// Profil → Informasi Akun: nomor salah ditolak di aplikasi, lalu nama baru tersimpan.
    func testUbahInformasiAkun() {
        bukaAplikasi(skenario: "checkout-ok")
        let nantiSaja = app.buttons["Nanti Saja"]
        if nantiSaja.exists { nantiSaja.tap(); sleep(1) }
        app.buttons["tab-profil"].tap()
        let pintu = app.buttons["menu-Informasi Akun"]
        XCTAssertTrue(pintu.waitForExistence(timeout: 5))
        pintu.tap()

        let nama = app.textFields["isian-nama"]
        XCTAssertTrue(nama.waitForExistence(timeout: 5))
        sleep(1)
        jepret("10-informasi-akun")

        let wa = app.textFields["isian-whatsapp"]
        ganti(wa, dengan: "12345")
        app.buttons["tombol-simpan-profil"].tap()
        XCTAssertTrue(app.staticTexts["Nomor WhatsApp harus nomor HP Indonesia, mis. 0812 3456 7890."].waitForExistence(timeout: 3))
        jepret("11-informasi-akun-galat")

        ganti(wa, dengan: "0812 9999 8888")
        ganti(nama, dengan: "Pelanggan Uji Baru")
        app.buttons["tombol-simpan-profil"].tap()
        XCTAssertTrue(app.staticTexts["Perubahan tersimpan."].waitForExistence(timeout: 5))
        XCTAssertEqual(wa.value as? String, "081299998888")
        jepret("12-informasi-akun-tersimpan")
    }

    /// Tanpa sesi, "Lanjut Pembayaran" membawa ke layar Masuk — bukan checkout.
    func testTanpaSesiLanjutBayarKeMasuk() {
        bukaAplikasi()
        tambahMenuPertamaLaluBukaKeranjang()
        app.buttons["tombol-lanjut-bayar"].tap()
        XCTAssertTrue(app.staticTexts["Selamat Datang!"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["tombol-bayar"].exists)
        XCTAssertTrue(app.buttons["tombol-masuk-google"].exists)
        XCTAssertTrue(app.buttons["tombol-masuk-apple"].exists)
        sleep(1)
        jepret("19-masuk")

        // iOS client ID Google belum dipasang: pesan jelas, bukan crash/diam.
        app.buttons["tombol-masuk-google"].tap()
        XCTAssertTrue(app.staticTexts["Masuk dengan Google belum diaktifkan di versi iOS ini."].waitForExistence(timeout: 5))
        jepret("20-masuk-google-belum-aktif")
    }

    /// Mengosongkan kolom dengan tombol hapus (tak bergantung bahasa simulator,
    /// tidak seperti menu "Select All"/"Pilih Semua"), lalu mengetik teks baru.
    private func ganti(_ kolom: XCUIElement, dengan teks: String) {
        kolom.tap()
        let lama = (kolom.value as? String) ?? ""
        kolom.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: lama.count + 2))
        kolom.typeText(teks)
    }

    private func jepret(_ nama: String) {
        let lampiran = XCTAttachment(screenshot: app.screenshot())
        lampiran.name = nama
        lampiran.lifetime = .keepAlways
        add(lampiran)
    }

    func testJelajahMenuSampaiKeranjang() {
        bukaAplikasi()
        jepret("01-beranda")

        let nantiSaja = app.buttons["Nanti Saja"]
        if nantiSaja.exists { nantiSaja.tap(); sleep(1) }
        let tabMenu = app.buttons["tab-menu"]
        XCTAssertTrue(tabMenu.waitForExistence(timeout: 5))
        jepret("02-beranda-tanpa-popup")

        tabMenu.tap()
        let kartu = app.buttons["kartu-menu"].firstMatch
        XCTAssertTrue(kartu.waitForExistence(timeout: 10))
        sleep(1)
        jepret("03-menu")

        kartu.tap()
        let tambah = app.buttons["tombol-tambah-keranjang"]
        XCTAssertTrue(tambah.waitForExistence(timeout: 5))
        sleep(1)
        jepret("04-detail")

        tambah.tap()
        XCTAssertTrue(app.buttons["bilah-keranjang"].waitForExistence(timeout: 5))
        sleep(1)
        jepret("05-menu-dengan-keranjang")

        app.buttons["tab-beranda"].tap()
        let ganti = app.buttons["ganti-outlet"]
        XCTAssertTrue(ganti.waitForExistence(timeout: 5))
        ganti.tap()
        XCTAssertTrue(app.staticTexts["Pilih Outlet"].waitForExistence(timeout: 5))
        sleep(2)
        jepret("06-pilih-outlet")
    }
}
