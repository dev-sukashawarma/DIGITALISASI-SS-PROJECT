import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

/// Padanan `gambarQris` (KodeQris.kt, ZXing) — di iOS memakai CoreImage, tanpa dependensi.
///
/// **Selalu hitam-putih murni, tanpa gaya, tanpa logo.** Pemindai QRIS di
/// aplikasi bank bervariasi mutunya; kode yang gagal dipindai di depan kasir
/// jauh lebih mahal daripada kode yang terlihat polos.
/// Koreksi galat **M**, bukan H: QRIS dinamis memuat banyak data, koreksi lebih
/// tinggi memperkecil tiap kotak dan justru mempersulit pemindaian.
///
/// Nil bila teks tak bisa disandikan — pemanggil WAJIB menyediakan jalan lain.
func gambarQris(_ isi: String, sisi: CGFloat = 720) -> UIImage? {
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(isi.utf8)
    filter.correctionLevel = "M"
    guard let keluaran = filter.outputImage, keluaran.extent.width > 0 else { return nil }
    // Diperbesar tanpa interpolasi supaya tepi modul tetap tajam.
    let skala = max(1, (sisi / keluaran.extent.width).rounded(.down))
    let besar = keluaran.transformed(by: CGAffineTransform(scaleX: skala, y: skala))
    guard let cg = CIContext().createCGImage(besar, from: besar.extent) else { return nil }
    return UIImage(cgImage: cg)
}

/// Kartu QRIS siap pindai. Latar PUTIH dipaksa, tak mengikuti tema: QR di
/// atas krem terbaca sebagian pemindai dan gagal di sebagian lain.
struct KartuQris: View {
    let qrString: String

    var body: some View {
        let gambar = gambarQris(qrString)
        ZStack {
            Color.white
            if let gambar {
                Image(uiImage: gambar)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .accessibilityLabel("Kode QRIS untuk pembayaran")
            } else {
                Text("Kode QR gagal digambar. Pakai tombol di bawah untuk membuka halaman pembayaran.")
                    .font(SukaFont.bodyMedium).foregroundStyle(.black).multilineTextAlignment(.center)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .padding(16)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
        .accessibilityIdentifier("kartu-qris")
    }
}
