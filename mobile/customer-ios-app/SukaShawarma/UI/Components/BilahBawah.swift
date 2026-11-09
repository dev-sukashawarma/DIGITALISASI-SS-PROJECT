import SwiftUI

/// Bilah putih melengkung yang menempel di bawah layar (tombol bayar, dst.) —
/// pola `bottomBar = { Surface(shape = RoundedCornerShape(top = 24.dp)) }` di Android.
struct BilahBawah<Isi: View>: View {
    @ViewBuilder var isi: () -> Isi

    var body: some View {
        isi()
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .padding(.horizontal, 20).padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background {
                UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                    .fill(Color.white)
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                        .stroke(Color.sukaBorder.opacity(0.6), lineWidth: 1))
                    .shadow(color: .black.opacity(0.10), radius: 12, y: -3)
                    .ignoresSafeArea(edges: .bottom)
            }
    }
}

/// Tombol oranye aksi utama di bilah bawah ("Lanjut Pembayaran", "Bayar Sekarang").
struct TombolAksi: View {
    let label: String
    var ikonKiri: String?
    var ikonKanan: String?
    var aktif = true
    let aksi: () -> Void

    var body: some View {
        Button(action: aksi) {
            HStack(spacing: 6) {
                if let ikonKiri { Image(systemName: ikonKiri).font(.system(size: 14, weight: .bold)) }
                Text(label).font(SukaFont.jakarta(13, weight: .bold))
                    .lineLimit(1).minimumScaleFactor(0.75)
                if let ikonKanan { Image(systemName: ikonKanan).font(.system(size: 14, weight: .bold)) }
            }
            .foregroundStyle(aktif ? Color.sukaInk : Color(white: 0.35))
            .padding(.horizontal, 20).padding(.vertical, 14)
            .background {
                if aktif {
                    Capsule().fill(SukaGradien.oranyePrimer)
                        .shadow(color: Color.sukaOrange.opacity(0.35), radius: 6, y: 2)
                } else {
                    Capsule().fill(Color(white: 0.88))
                }
            }
        }
        .buttonStyle(.mentul(0.94))
        .disabled(!aktif)
    }
}

/// Satu baris label–nilai di kartu ringkasan pembayaran.
struct BarisRingkasan: View {
    let label: String
    let nilai: String
    var warnaLabel: Color = .sukaMuted
    var warnaNilai: Color = .sukaInk
    var tebal = false

    var body: some View {
        HStack {
            Text(label).font(SukaFont.jakarta(tebal ? 13 : 12, weight: tebal ? .bold : .regular))
                .foregroundStyle(tebal ? Color.sukaInk : warnaLabel)
            Spacer()
            Text(nilai).font(tebal ? SukaFont.lilita(18) : SukaFont.jakarta(13, weight: .bold)).foregroundStyle(warnaNilai)
        }
    }
}

/// Kartu info "ambil di outlet" di atas keranjang & checkout.
struct KartuPickup: View {
    let judul: String
    /// Nama outlet wajib terlihat sebelum bayar: pelanggan memilih dari puluhan
    /// outlet dan salah outlet berarti datang ke tempat yang salah.
    var namaOutlet: String? = nil
    let keterangan: String

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 11)
                    .fill(Color.sukaOrange.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.sukaOrange)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(judul).font(SukaFont.jakarta(10, weight: .bold)).tracking(0.6).foregroundStyle(Color.sukaOrangeTeks)
                if let namaOutlet {
                    Text(namaOutlet).font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                }
                Text(keterangan).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .kartuElegan(sudut: 16, elevasi: 1, latar: .white)
    }
}

/// Alasan tombol pesan dikunci (jam tutup, tutup sementara) — tampil persis di
/// atas tombol. Menu/keranjang tetap bisa dilihat; hanya aksi pesan yang dikunci.
struct KeteranganOutletTutup: View {
    let teks: String?

    var body: some View {
        Text(teks ?? "Outlet sedang tidak menerima pesanan.")
            .font(SukaFont.jakarta(11, weight: .medium)).foregroundStyle(Color.sukaMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("keterangan-outlet-tutup")
    }
}
