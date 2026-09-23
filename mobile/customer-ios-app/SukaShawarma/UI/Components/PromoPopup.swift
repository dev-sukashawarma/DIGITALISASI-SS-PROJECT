import SwiftUI

/// Padanan `PromoPopupDialog.kt`. Seluruh isi dari banner gateway — TIDAK ADA
/// nilai default. Tidak ada tempat voucher dengan sengaja (sistemnya belum ada).
struct PromoPopup: View {
    let banner: BannerDto
    let onTutup: () -> Void
    let onKlaim: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
                .onTapGesture(perform: onTutup)
                .accessibilityHidden(true)

            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    if banner.gambarUrl != nil {
                        GambarJarak(url: banner.gambarUrl, latar: .sukaBrown)
                    } else {
                        Color.sukaTint
                    }
                    LinearGradient(colors: [.black.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 60)
                    HStack(alignment: .top) {
                        if let badge = banner.badge, !badge.trimmingCharacters(in: .whitespaces).isEmpty {
                            Text(badge).font(SukaFont.jakarta(10, weight: .bold)).tracking(0.5)
                                .foregroundStyle(Color.sukaInk)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: 12))
                        }
                        Spacer()
                        Button(action: onTutup) {
                            Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                                .frame(width: 34, height: 34)
                                .background(Color.black.opacity(0.6), in: Circle())
                        }
                        .accessibilityLabel("Tutup")
                    }
                    .padding(12)
                }
                .frame(height: 190)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, topTrailingRadius: 26))

                VStack(spacing: 12) {
                    Text(banner.judul).font(SukaFont.lilita(22)).foregroundStyle(Color.sukaInk)
                        .multilineTextAlignment(.center)
                    if let sub = banner.subjudul, !sub.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text(sub).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaBody)
                            .multilineTextAlignment(.center).padding(.horizontal, 6)
                    }
                    if let tombol = banner.teksTombol, !tombol.trimmingCharacters(in: .whitespaces).isEmpty {
                        Button(action: onKlaim) {
                            Text(tombol).font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                                .frame(maxWidth: .infinity, minHeight: 46)
                                .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.mentul(0.97))
                        .padding(.top, 2)
                    }
                    Button("Nanti Saja", action: onTutup)
                        .font(SukaFont.jakarta(12, weight: .medium))
                        .foregroundStyle(Color.sukaMuted)
                        .padding(.horizontal, 12).padding(.vertical, 4)
                }
                .padding(.horizontal, 20).padding(.vertical, 18)
            }
            .background(Color.sukaCream, in: RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(Color.sukaOrange.opacity(0.35), lineWidth: 1.5))
            .bayangan(16)
            .padding(.horizontal, 24)
            .accessibilityAddTraits(.isModal)
        }
    }
}
