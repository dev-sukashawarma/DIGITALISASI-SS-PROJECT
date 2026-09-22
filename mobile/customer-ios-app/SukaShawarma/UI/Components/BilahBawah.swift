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
            .foregroundStyle(aktif ? Color.sukaInk : Color(white: 0.3))
            .padding(.horizontal, 20).padding(.vertical, 14)
            .background(aktif ? Color.sukaOrange : Color(white: 0.83), in: RoundedRectangle(cornerRadius: 18))
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
    let keterangan: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "mappin").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.sukaOrange)
                .frame(width: 34, height: 34).background(Color.sukaOrange.opacity(0.15), in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(judul).font(SukaFont.jakarta(10, weight: .bold)).tracking(0.5).foregroundStyle(Color.sukaBrown)
                Text(keterangan).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .kartuSuka(sudut: 16, elevasi: 0, tepi: .sukaBorder.opacity(0.7))
    }
}
