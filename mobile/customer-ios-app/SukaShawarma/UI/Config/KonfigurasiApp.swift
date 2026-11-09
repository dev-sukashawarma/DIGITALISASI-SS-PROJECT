import SwiftUI

/// Padanan `ui/config/KonfigurasiApp.kt` + `TautanApp.kt`.

/// Config gagal dimuat -> TIDAK memaksa update: pelanggan tak boleh terkunci
/// karena jaringan. `versi_minimum_ios` absen (gateway lama) = sama.
func perluUpdate(versiTerpasang: Int, config: ConfigDto?) -> Bool {
    guard let minimum = config?.versiMinimumIos else { return false }
    return versiTerpasang < minimum
}

/// Nomor build terpasang (`CFBundleVersion` = CURRENT_PROJECT_VERSION),
/// padanan `BuildConfig.VERSION_CODE`.
func versiBuildTerpasang(_ bundle: Bundle = .main) -> Int {
    Int(bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 1
}

/// Tautan wa.me siap pakai; nil bila `waCs` belum diisi (baris/tombol jangan ditampilkan).
func tautanWa(_ waCs: String?, teks: String) -> URL? {
    guard let wa = waCs?.trimmingCharacters(in: .whitespaces), !wa.isEmpty else { return nil }
    var boleh = CharacterSet.alphanumerics
    boleh.insert(charactersIn: "-._~")
    let isi = teks.addingPercentEncoding(withAllowedCharacters: boleh) ?? ""
    return URL(string: "https://wa.me/\(wa)?text=\(isi)")
}

/// URL http(s) dari setelan admin; nil bila kosong atau bukan tautan web.
func tautanWeb(_ teks: String?) -> URL? {
    guard let t = teks?.trimmingCharacters(in: .whitespaces), !t.isEmpty,
          let url = URL(string: t), let skema = url.scheme?.lowercased(), skema == "https" || skema == "http"
    else { return nil }
    return url
}

/// Kebijakan Privasi: setelan admin bila terisi, kalau tidak halaman resmi
/// `<gateway>/privasi`. Selalu ada — App Store & Play Store mewajibkannya.
/// Beda kecil dengan Android (yang memakai teks admin apa adanya): setelan yang
/// bukan tautan http(s) jatuh ke halaman resmi, bukan tombol yang gagal dibuka.
func urlKebijakanPrivasi(_ urlPrivasi: String?, baseURL: URL) -> URL {
    tautanWeb(urlPrivasi) ?? baseURL.appending(path: "privasi")
}

/// Syarat & Ketentuan: setelan admin bila terisi, kalau tidak `<gateway>/syarat`.
func urlSyaratKetentuan(_ urlSyarat: String?, baseURL: URL) -> URL {
    tautanWeb(urlSyarat) ?? baseURL.appending(path: "syarat")
}

/// Config yang sedang berlaku; bawaan dipakai sampai/bila gateway gagal.
extension EnvironmentValues {
    @Entry var configApp = ConfigDto()
}

/// Halaman App Store aplikasi. Kosong sampai aplikasi terbit (Apple ID baru
/// ada setelah App Store Connect dibuat) — tombol disembunyikan selama nil.
let tautanAppStore: URL? = nil

struct LayarPerbaruiAplikasi: View {
    @Environment(\.openURL) private var bukaUrl

    var body: some View {
        VStack(spacing: 12) {
            Text("Perbarui aplikasi").font(SukaFont.titleLarge).foregroundStyle(Color.sukaInk)
            Text("Versi aplikasi ini sudah tidak didukung. Perbarui dari App Store untuk lanjut memesan.")
                .font(SukaFont.bodyMedium).foregroundStyle(Color.sukaBody).multilineTextAlignment(.center)
            if let tautanAppStore {
                TombolUtama(label: "Buka App Store") { bukaUrl(tautanAppStore) }
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sukaCream.ignoresSafeArea())
    }
}
