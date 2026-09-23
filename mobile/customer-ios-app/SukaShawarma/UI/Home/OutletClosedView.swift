import SwiftUI

/// Jam buka outlet. Nilai tetap dari sisi operasional (sama dengan Android).
private let jamBukaOperasional = "14:00"

/// Padanan `OutletClosedScreen.kt` — outlet belum melayani pesanan aplikasi.
struct OutletClosedView: View {
    let namaOutlet: String
    let onGantiOutlet: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "clock").font(.system(size: 32)).foregroundStyle(Color.sukaOrange)
                .frame(width: 68, height: 68).background(Color.sukaCreamTeks, in: Circle())
            Text("BUKA JAM \(jamBukaOperasional) WIB").font(SukaFont.jakarta(10, weight: .bold)).tracking(0.5)
                .foregroundStyle(Color.sukaBrown)
                .padding(.horizontal, 12).padding(.vertical, 4)
                .background(Color(hex: 0xFFF0E2), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.sukaOrange.opacity(0.35), lineWidth: 1))
            Text("Outlet Belum Buka").font(SukaFont.lilita(22)).foregroundStyle(Color.sukaBrown)
            Text("\(namaOutlet) belum melayani pesanan aplikasi saat ini. Keranjangmu tetap kami simpan dengan aman.")
                .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted).multilineTextAlignment(.center)

            Button(action: onGantiOutlet) {
                Text("Pilih Outlet Lain").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Color.sukaOrange, in: Capsule())
            }
            .buttonStyle(.mentul())
            .padding(.top, 4)

            HStack(spacing: 6) {
                Image(systemName: "bell.fill").font(.system(size: 13))
                Text("Ingatkan Saya Saat Buka").font(SukaFont.jakarta(12))
            }
            .foregroundStyle(Color.sukaMuted)
            .frame(maxWidth: .infinity, minHeight: 46)
            .overlay(Capsule().stroke(Color(hex: 0xE5E7EB), lineWidth: 1))
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Belum tersedia")

            Text("Fitur pengingat notifikasi akan hadir di pembaruan berikutnya.")
                .font(SukaFont.jakarta(10)).foregroundStyle(Color.sukaMuted.opacity(0.8)).multilineTextAlignment(.center)
        }
        .padding(24)
        .kartuSuka(sudut: 26, elevasi: 4)
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sukaCream)
    }
}
