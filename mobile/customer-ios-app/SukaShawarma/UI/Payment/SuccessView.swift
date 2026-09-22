import SwiftUI

/// Padanan `SuccessScreen.kt`: pesanan dibayar, tampilkan nomor pengambilan POS.
struct SuccessView: View {
    let nomorPesanan: Int?
    let namaOutlet: String?
    let onLihatStatus: () -> Void
    let onKembaliKeMenu: () -> Void
    @State private var tampil = false

    /// Ukuran nomor menyusut mengikuti panjangnya (sama dengan Android).
    private var ukuranNomor: CGFloat {
        switch String(nomorPesanan ?? 0).count {
        case 0...4: 54
        case 5: 44
        case 6: 36
        default: 28
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onKembaliKeMenu) {
                    Image(systemName: "xmark").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        .frame(width: 40, height: 40).background(Color.white, in: Circle())
                }
                .accessibilityLabel("Tutup")
                Spacer()
                Text("ORDER-AHEAD & PICK-UP").font(SukaFont.jakarta(11, weight: .bold)).tracking(0.5).foregroundStyle(Color.sukaBrown)
                Spacer()
                Color.clear.frame(width: 40, height: 40)
            }
            .padding(.horizontal, 16).padding(.vertical, 8)

            ScrollView {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark").font(.system(size: 30, weight: .heavy)).foregroundStyle(.white)
                        .frame(width: 72, height: 72).background(Color.sukaGreen, in: Circle())
                        .padding(10).background(Color.sukaGreen.opacity(0.15), in: Circle())
                        .scaleEffect(tampil ? 1 : 0.5).opacity(tampil ? 1 : 0)
                        .accessibilityHidden(true)
                    Text("Pesanan Berhasil!").font(SukaFont.lilita(28)).foregroundStyle(Color.sukaBrown)
                    Text("Pembayaran terkonfirmasi. Dapur Suka sedang menyiapkan pesanan lezatmu.")
                        .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted).multilineTextAlignment(.center)

                    VStack(spacing: 6) {
                        Text("KODE PENGAMBILAN KASIR").font(SukaFont.jakarta(11, weight: .bold)).tracking(0.8).foregroundStyle(Color.sukaMuted)
                        Text(nomorPesanan.map(String.init) ?? "-").font(SukaFont.lilita(ukuranNomor)).foregroundStyle(Color.sukaBrown)
                            .accessibilityIdentifier("nomor-pesanan")
                        Text("Sebutkan nomor ini di kasir saat mengambil pesanan.").font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted)
                    }
                    .padding(20).frame(maxWidth: .infinity)
                    .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Color.sukaOrange, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))

                    VStack(spacing: 10) {
                        BarisRingkasan(label: "Outlet Pengambilan", nilai: namaOutlet ?? "Suka Shawarma")
                        BarisRingkasan(label: "Estimasi Siap", nilai: "15–20 Menit")
                        BarisRingkasan(label: "Metode Ambil", nilai: "Ambil Mandiri (Self-Pickup)")
                    }
                    .padding(16).kartuSuka(sudut: 18, elevasi: 2)

                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "storefront.fill").foregroundStyle(Color.sukaOrange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Tips Pengambilan di Outlet:").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaInk)
                            Text("Kamu bisa langsung menuju counter khusus Online Pickup tanpa perlu ikut antrean kasir.")
                                .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        }
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 16))
                }
                .padding(16)
            }

            BilahBawah {
                VStack(spacing: 4) {
                    TombolAksi(label: "Lihat Status Pesanan", ikonKanan: "arrow.right", aksi: onLihatStatus)
                    Button("Kembali ke Menu", action: onKembaliKeMenu)
                        .font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaMuted).frame(minHeight: 40)
                }
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden()
        .onAppear {
            withAnimation(.spring(response: 0.45, dampingFraction: 0.55)) { tampil = true }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }
}
