import SwiftUI

/// Padanan `MainActivity.kt`. Titik masuk aplikasi.
@main
struct SukaShawarmaApp: App {
    @State private var container = AppContainer()
    @State private var splashSelesai = false
    // Dibaca sekali saat mulai: yang tampil selalu simpanan pembukaan sebelumnya.
    @State private var gambarSplash: Data?
    @State private var durasiSplash: Int64 = durasiSplashBawaanMs

    init() {
        let store = SplashStore()
        _gambarSplash = State(initialValue: store.dataGambar())
        _durasiSplash = State(initialValue: store.durasiMs())
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                AppShell()
                if !splashSelesai {
                    SplashAplikasiView(dataGambar: gambarSplash, durasiMs: durasiSplash) {
                        withAnimation(.easeOut(duration: 0.25)) { splashSelesai = true }
                    }
                    .transition(.opacity)
                    .zIndex(1)
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
            .preferredColorScheme(.dark)
            .task(priority: .background) {
                // Untuk pembukaan BERIKUTNYA; kegagalan diabaikan (lihat perbaruiSplash).
                await perbaruiSplash(repository: container.repository, store: container.splashStore)
            }
        }
    }
}
