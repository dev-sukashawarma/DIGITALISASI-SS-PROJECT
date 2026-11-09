import SwiftUI
import UIKit

/// Padanan `MainActivity.kt`. Titik masuk aplikasi.
@main
struct SukaShawarmaApp: App {
    // Closure WindowGroup sengaja hanya membuat `AkarAplikasi`: SwiftUI bisa
    // mengevaluasinya di thread render async, dan membaca state @MainActor
    // (AppContainer) di sini menjatuhkan aplikasi (pemeriksaan isolasi Swift 6).
    var body: some Scene {
        WindowGroup { AkarAplikasi() }
    }
}

/// Akar tampilan: shell aplikasi + dua tahap splash.
struct AkarAplikasi: View {
    @State private var container = AppContainer()
    /// Tahap 1: splash logo (lanjutan layar peluncuran) + animasi memuat.
    @State private var merekSelesai = false
    /// Tahap 2: foto layar penuh dari admin dashboard — hanya bila ada.
    @State private var splashSelesai = false
    @State private var fotoSplash: UIImage?
    @State private var durasiSplash: Int64 = durasiSplashBawaanMs

    init() {
        let store = SplashStore()
        _fotoSplash = State(initialValue: store.dataGambar().flatMap(UIImage.init(data:)))
        _durasiSplash = State(initialValue: store.durasiMs())
    }

    var body: some View {
        ZStack {
            AppShell()
            // Hitungan durasi foto dimulai saat ia tampil, jadi baru
            // dirender SETELAH splash logo selesai.
            if merekSelesai && !splashSelesai, let fotoSplash {
                SplashAplikasiView(gambar: fotoSplash, durasiMs: durasiSplash) {
                    withAnimation(.easeOut(duration: 0.25)) { splashSelesai = true }
                }
                .transition(.opacity)
                .zIndex(1)
            }
            if !merekSelesai {
                SplashMerekView()
                    .transition(.opacity)
                    .zIndex(2)
            }
        }
        .environment(container)
        .tint(.sukaBrown)
        // Ikon bilah status (jam, sinyal, baterai) PUTIH di atas latar cokelat.
        // SwiftUI menurunkan gaya bilah status dari skema warna JENDELA, jadi
        // jendela diberi skema gelap, sementara SELURUH isi aplikasi tetap
        // dirender terang lewat `.environment(\.colorScheme, .light)` di bawah.
        // (Info.plist UIStatusBarStyle diabaikan iOS terbaru.)
        .environment(\.colorScheme, .light)
        .preferredColorScheme(container.ikonBilahStatusGelap ? .light : .dark)
        .task { await jalankanSplash() }
    }

    /// Splash logo minimal `durasiSplashMerekMs`. Bila HP belum menyimpan foto
    /// admin (pemasangan baru), foto diunduh SEKARANG selama splash logo —
    /// paling lama `batasTungguFotoSplashMs` — supaya langsung tampil, bukan baru
    /// di pembukaan berikutnya. Bila sudah tersimpan, disegarkan di latar untuk
    /// pembukaan berikutnya.
    private func jalankanSplash() async {
        #if DEBUG
        if SkenarioUji.aktif && UserDefaults.standard.string(forKey: "ujiSplash") == nil {
            merekSelesai = true
            splashSelesai = true
            return
        }
        #endif
        let repository = container.repository, store = container.splashStore
        let mulai = ContinuousClock.now
        if fotoSplash == nil {
            // Unduhan berjalan sebagai Task tersendiri: bila batas tunggu lewat,
            // HANYA penantiannya yang dihentikan — unduhan jalan terus dan
            // fotonya tersimpan untuk pembukaan berikutnya.
            let unduh = Task { await perbaruiSplash(repository: repository, store: store) }
            await withTaskGroup(of: Void.self) { grup in
                grup.addTask { await unduh.value }
                grup.addTask { try? await Task.sleep(for: .milliseconds(batasTungguFotoSplashMs)) }
                await grup.next()
                grup.cancelAll()
            }
            fotoSplash = store.dataGambar().flatMap(UIImage.init(data:))
            durasiSplash = store.durasiMs()
        } else {
            Task(priority: .background) { await perbaruiSplash(repository: repository, store: store) }
        }
        let sisa = Duration.milliseconds(durasiSplashMerekMs) - (ContinuousClock.now - mulai)
        if sisa > .zero { try? await Task.sleep(for: sisa) }
        withAnimation(.easeOut(duration: 0.3)) {
            merekSelesai = true
            // Tanpa foto admin: langsung masuk aplikasi, tak ada splash kedua.
            if fotoSplash == nil { splashSelesai = true }
        }
    }
}
