import SwiftUI

/// Gambar dari URL gateway (padanan Coil `AsyncImage`). Latar tetap terlihat
/// selama memuat / bila gagal — kartu tidak pernah putih kosong. Sengaja TANPA
/// gambar cadangan dari luar (keputusan yang sama dengan Android).
struct GambarJarak: View {
    let url: String?
    var latar: Color = .sukaTint
    var ikonCadangan: String?
    var ukuranIkon: CGFloat = 32

    var body: some View {
        ZStack {
            latar
            if let url, !url.isEmpty, let alamat = URL(string: url) {
                AsyncImage(url: alamat, transaction: Transaction(animation: .easeOut(duration: 0.2))) { fase in
                    if let gambar = fase.image {
                        gambar.resizable().scaledToFill()
                    } else if fase.error != nil, let ikonCadangan {
                        Image(systemName: ikonCadangan).font(.system(size: ukuranIkon)).foregroundStyle(Color.sukaOrange)
                    }
                }
            } else if let ikonCadangan {
                Image(systemName: ikonCadangan).font(.system(size: ukuranIkon)).foregroundStyle(Color.sukaOrange)
            }
        }
        .clipped()
    }
}
