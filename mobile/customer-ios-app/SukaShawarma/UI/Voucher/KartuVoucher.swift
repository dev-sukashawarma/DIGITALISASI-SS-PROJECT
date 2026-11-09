import SwiftUI

/// Padanan `ui/voucher/KartuVoucher.kt`: kartu voucher bergaya tiket kupon —
/// potongan kiri berwarna berisi nilai (Rp5rb, 20%, Gratis), sobekan
/// putus-putus, lalu nama, syarat, masa berlaku, dan tombol Pakai. Dipakai
/// halaman Voucher dan pemilih voucher di checkout supaya keduanya seragam.
struct KartuVoucher: View {
    let voucher: VoucherDto
    let onPakai: () -> Void

    private static let lebarPotongan: CGFloat = 92
    private static let jariLekuk: CGFloat = 8
    private static let warnaPudar = Color(hex: 0xB4A79C)

    var body: some View {
        let (nilai, sub) = nilaiKartu(voucher)
        let berlakuSampai = labelBerlakuSampai(voucher.selesai)
        let syarat = syaratTanpaTanggal(voucher.kalimatSyarat, berlakuSampai: berlakuSampai)
        let (latar, teks) = warnaPotongan
        let bentuk = BentukTiket(posisiLekuk: Self.lebarPotongan, jariLekuk: Self.jariLekuk, sudut: 16)

        HStack(spacing: 0) {
            VStack(spacing: 2) {
                Text(nilai).font(SukaFont.jakarta(nilai.count > 6 ? 18 : 22, weight: .bold))
                    .foregroundStyle(teks).lineLimit(1).minimumScaleFactor(0.7)
                if !sub.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text(sub).font(SukaFont.jakarta(11)).foregroundStyle(teks.opacity(0.9))
                        .lineLimit(2).multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 6).padding(.vertical, 14)
            .frame(width: Self.lebarPotongan)
            .frame(maxHeight: .infinity)
            .background(latar)

            GarisSobek().frame(width: 1).padding(.vertical, 12)

            VStack(alignment: .leading, spacing: 3) {
                Text(voucher.nama).font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk).lineLimit(2)
                if !syarat.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text(syarat).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted).lineLimit(2)
                }
                if let d = voucher.deskripsi, !d.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text(d).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaBody).lineLimit(2)
                }
                HStack(spacing: 8) {
                    if let berlakuSampai {
                        Label(berlakuSampai, systemImage: "clock")
                            .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    if voucher.bolehDipakai {
                        Button(action: onPakai) {
                            Text("Pakai").font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
                                .padding(.horizontal, 18).frame(height: 34)
                                .background(Color.sukaOrange, in: Capsule())
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.mentul(0.94))
                        .accessibilityIdentifier("pakai-\(voucher.id)")
                    }
                }
                .padding(.top, 6)
                if !voucher.bolehDipakai, let alasan = voucher.alasan {
                    Text(alasan).font(SukaFont.jakarta(11, weight: .medium)).foregroundStyle(Color.sukaBody)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(Color.sukaTint, in: Capsule())
                        .padding(.top, 2)
                }
            }
            .padding(.leading, 12).padding(.trailing, 14).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(Color.white)
        .clipShape(bentuk)
        .overlay(bentuk.stroke(Color.sukaBorder, lineWidth: 1))
        .opacity(voucher.bolehDipakai ? 1 : 0.65)
        .accessibilityElement(children: .contain)
    }

    private var warnaPotongan: (Color, Color) {
        switch warnaKartu(voucher) {
        case .oranye: (.sukaOrange, .sukaInk)
        case .cokelat: (.sukaBrown, .white)
        case .hijau: (.sukaGreen, .white)
        case .pudar: (Self.warnaPudar, .white)
        }
    }
}

/// Garis putus-putus di antara potongan kiri dan isi kartu.
private struct GarisSobek: View {
    var body: some View {
        GeometryReader { g in
            Path { p in
                p.move(to: .zero)
                p.addLine(to: CGPoint(x: 0, y: g.size.height))
            }
            .stroke(Color.sukaBorder, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
        }
    }
}

/// Persegi bersudut bulat dengan dua lekukan setengah lingkaran di tepi atas
/// dan bawah, tepat di garis sobek — kesan tiket yang bisa dirobek.
private struct BentukTiket: Shape {
    let posisiLekuk: CGFloat
    let jariLekuk: CGFloat
    let sudut: CGFloat

    func path(in rect: CGRect) -> Path {
        let dasar = Path(roundedRect: rect, cornerRadius: sudut)
        var lekuk = Path()
        lekuk.addEllipse(in: CGRect(x: posisiLekuk - jariLekuk, y: -jariLekuk, width: jariLekuk * 2, height: jariLekuk * 2))
        lekuk.addEllipse(in: CGRect(x: posisiLekuk - jariLekuk, y: rect.height - jariLekuk,
                                    width: jariLekuk * 2, height: jariLekuk * 2))
        return dasar.subtracting(lekuk)
    }
}
