import SwiftUI

/// Padanan `ui/components/States.kt`.
struct MemuatState: View {
    var body: some View {
        ProgressView()
            .tint(.sukaBrown)
            .frame(maxWidth: .infinity)
            .padding(32)
    }
}

struct EmptyState: View {
    let judul: String
    let penjelasan: String
    var tombol: (label: String, aksi: () -> Void)?

    var body: some View {
        VStack(spacing: 8) {
            Text(judul).font(SukaFont.titleLarge).foregroundStyle(Color.sukaInk)
            Text(penjelasan)
                .font(SukaFont.bodyMedium)
                .foregroundStyle(Color.sukaBody)
                .multilineTextAlignment(.center)
            if let tombol {
                TombolUtama(label: tombol.label, aksi: tombol.aksi).padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }
}

/// Menerjemahkan galat gateway jadi kalimat yang bisa ditindak pelanggan.
/// Satu-satunya tempat kalimat ini dikarang — layar tidak boleh membuat sendiri.
func pesanGalat(_ galat: GatewayError) -> String {
    switch galat {
    case .jaringan: "Tidak bisa terhubung. Periksa koneksi internetmu, lalu coba lagi."
    case .server: "Layanan sedang bermasalah. Coba lagi sebentar lagi."
    case .sesiTidakSah: "Sesimu sudah berakhir. Masuk lagi untuk melanjutkan."
    case .kode(_, let pesan): pesan
    }
}

struct ErrorState: View {
    let galat: GatewayError
    let onCobaLagi: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text("Gagal memuat").font(SukaFont.titleLarge).foregroundStyle(Color.sukaInk)
            Text(pesanGalat(galat))
                .font(SukaFont.bodyMedium)
                .foregroundStyle(Color.sukaBody)
                .multilineTextAlignment(.center)
            TombolUtama(label: "Coba lagi", aksi: onCobaLagi)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }
}

/// Tombol pil cokelat — padanan `Button` Material3 dengan tema Suka.
struct TombolUtama: View {
    let label: String
    let aksi: () -> Void

    var body: some View {
        Button(action: aksi) {
            Text(label)
                .font(SukaFont.jakarta(14, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 24).padding(.vertical, 12)
                .background(Color.sukaBrown, in: Capsule())
        }
        .buttonStyle(.mentul())
    }
}
