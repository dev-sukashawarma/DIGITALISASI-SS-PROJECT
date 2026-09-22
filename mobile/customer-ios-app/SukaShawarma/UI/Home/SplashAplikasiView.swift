import SwiftUI
import UIKit

/// Padanan `SplashAplikasiScreen.kt`: gambar penuh yang bisa diganti dari
/// admin dashboard, sebagai LAPISAN di atas aplikasi (Beranda sudah mulai
/// dimuat di belakangnya). Tanpa tombol lewati — durasi diatur admin (1–5 dtk).
///
/// Beda dengan Android: tidak perlu menunggu "splash sistem hilang". Layar
/// peluncuran iOS diganti tepat saat tampilan pertama digambar, jadi hitungan
/// durasi dimulai saat layar ini muncul.
struct SplashAplikasiView: View {
    let dataGambar: Data?
    let durasiMs: Int64
    let onSelesai: () -> Void

    var body: some View {
        ZStack {
            Color.sukaBrown
            // Didekode sekali, sinkron — berkasnya kecil (dikecilkan admin saat
            // unggah); memuat asinkron membuat gambar bawaan sempat berkedip.
            if let data = dataGambar, let ui = UIImage(data: data) {
                Image(uiImage: ui).resizable().scaledToFill()
            } else {
                Image("SplashBawaan").resizable().scaledToFill()
            }
        }
        .ignoresSafeArea()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Suka Shawarma")
        .task {
            try? await Task.sleep(for: .milliseconds(durasiMs))
            onSelesai()
        }
    }
}
