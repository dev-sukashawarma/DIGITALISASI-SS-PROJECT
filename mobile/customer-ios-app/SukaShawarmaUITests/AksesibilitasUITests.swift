import XCTest

/// Layar utama dengan teks ukuran AKSESIBILITAS terbesar (setelan "Teks Lebih
/// Besar" iPhone). Menyimpan tangkapan layar untuk diperiksa manual: tidak ada
/// teks yang terpotong atau tombol yang tak terjangkau.
@MainActor
final class AksesibilitasUITests: XCTestCase {
    private let app = XCUIApplication()

    private func jepret(_ nama: String) {
        let l = XCTAttachment(screenshot: app.screenshot())
        l.name = nama
        l.lifetime = .keepAlways
        add(l)
    }

    func testTeksBesar() {
        continueAfterFailure = false
        app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityL",
                                "-skenarioUji", "checkout-ok"]
        app.launch()
        let tabMenu = app.buttons["tab-menu"]
        let nantiSaja = app.buttons["Nanti Saja"]
        expectation(for: NSPredicate { _, _ in tabMenu.exists || nantiSaja.exists }, evaluatedWith: nil)
        waitForExpectations(timeout: 40)
        sleep(2)
        if nantiSaja.exists { jepret("a11y-01-popup"); nantiSaja.tap(); sleep(1) }
        jepret("a11y-02-beranda")

        tabMenu.tap()
        let kartu = app.buttons["kartu-menu"].firstMatch
        XCTAssertTrue(kartu.waitForExistence(timeout: 10))
        sleep(1)
        jepret("a11y-03-menu")
        kartu.tap()
        XCTAssertTrue(app.buttons["tombol-tambah-keranjang"].waitForExistence(timeout: 5))
        sleep(1)
        jepret("a11y-04-detail")
        app.buttons["tombol-tambah-keranjang"].tap()
        app.buttons["bilah-keranjang"].tap()
        XCTAssertTrue(app.buttons["tombol-lanjut-bayar"].waitForExistence(timeout: 5))
        sleep(1)
        jepret("a11y-05-keranjang")
        app.buttons["tombol-lanjut-bayar"].tap()
        XCTAssertTrue(app.buttons["tombol-bayar"].waitForExistence(timeout: 10))
        sleep(2)
        jepret("a11y-06-checkout")
    }
}
