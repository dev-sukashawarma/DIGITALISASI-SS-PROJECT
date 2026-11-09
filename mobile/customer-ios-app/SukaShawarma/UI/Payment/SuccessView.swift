import SwiftUI

/// Padanan `SuccessScreen.kt`: pesanan dibayar, tampilkan nomor pengambilan POS.
struct SuccessView: View {
    @Environment(\.configApp) private var config
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
                    ZStack {
                        Circle()
                            .fill(Color.sukaGreen.opacity(0.15))
                            .frame(width: 90, height: 90)
                            .scaleEffect(tampil ? 1.05 : 0.8)
                            .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: tampil)
                        Image(systemName: "checkmark")
                            .font(.system(size: 30, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(width: 68, height: 68)
                            .background(Color.sukaGreen, in: Circle())
                            .shadow(color: Color.sukaGreen.opacity(0.35), radius: 8, y: 3)
                    }
                    .scaleEffect(tampil ? 1 : 0.5)
                    .opacity(tampil ? 1 : 0)
                    .accessibilityHidden(true)
                    .padding(.top, 8)

                    Text("Pesanan Berhasil!").font(SukaFont.lilita(30)).foregroundStyle(Color.sukaBrown)
                    Text("Pembayaran terkonfirmasi. Dapur Suka sedang menyiapkan pesanan lezatmu.")
                        .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted).multilineTextAlignment(.center)
                        .padding(.horizontal, 16)

                    VStack(spacing: 6) {
                        Text("KODE PENGAMBILAN KASIR").font(SukaFont.jakarta(11, weight: .bold)).tracking(1.0).foregroundStyle(Color.sukaMuted)
                        Text(nomorPesanan.map(String.init) ?? "-")
                            .font(SukaFont.lilita(ukuranNomor))
                            .foregroundStyle(Color.sukaBrown)
                            .accessibilityIdentifier("nomor-pesanan")
                        Text("Sebutkan nomor ini di kasir saat mengambil pesanan.").font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted)
                    }
                    .padding(20).frame(maxWidth: .infinity)
                    .background {
                        RoundedRectangle(cornerRadius: 20)
                            .fill(LinearGradient(colors: [Color(hex: "FFF8F2"), Color(hex: "FFF2E6")], startPoint: .topLeading, endPoint: .bottomTrailing))
                    }
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Color.sukaOrange.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
                    .shadow(color: Color.sukaOrange.opacity(0.08), radius: 6, y: 2)

                    VStack(spacing: 10) {
                        BarisRingkasan(label: "Outlet Pengambilan", nilai: namaOutlet ?? "Suka Shawarma")
                        BarisRingkasan(label: "Estimasi Siap", nilai: config.estimasiSiap)
                        BarisRingkasan(label: "Metode Ambil", nilai: "Ambil Mandiri (Self-Pickup)")
                    }
                    .padding(16)
                    .kartuElegan(sudut: 18, elevasi: 1, latar: .white)

                    HStack(alignment: .top, spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.sukaOrange.opacity(0.15))
                                .frame(width: 36, height: 36)
                            Image(systemName: "storefront.fill").foregroundStyle(Color.sukaOrange)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Tips Pengambilan di Outlet:").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaInk)
                            Text("Kamu bisa langsung menuju counter khusus Online Pickup tanpa perlu ikut antrean kasir.")
                                .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        }
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .kartuElegan(sudut: 16, elevasi: 1, latar: .white)
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
        .latarBilahStatus()
        .toolbar(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden()
        .onAppear {
            withAnimation(.spring(response: 0.45, dampingFraction: 0.55)) { tampil = true }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }
}
