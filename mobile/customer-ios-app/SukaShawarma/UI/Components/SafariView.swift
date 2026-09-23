import SafariServices
import SwiftUI

/// Halaman bayar cadangan (padanan Chrome Custom Tabs di Android) — BUKAN
/// WKWebView sendiri: pelanggan melihat alamat asli Xendit dan kuncinya.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let vc = SFSafariViewController(url: url)
        vc.preferredBarTintColor = UIColor(Color.sukaBrown)
        vc.preferredControlTintColor = .white
        return vc
    }

    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}
}

/// Pembungkus agar URL bisa dipakai di `.sheet(item:)` / `.fullScreenCover(item:)`.
struct AlamatWeb: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
