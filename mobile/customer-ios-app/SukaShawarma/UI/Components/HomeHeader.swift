import SwiftUI

/// Padanan `ui/components/HomeHeader.kt`: tiga kepala cokelat melengkung.

private let bentukKepala = UnevenRoundedRectangle(bottomLeadingRadius: 22, bottomTrailingRadius: 22)

private struct LatarKepala: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background {
                bentukKepala.fill(SukaGradien.kepala)
                    .bayangan(5)
                    .ignoresSafeArea(edges: .top)
            }
    }
}

private struct LogoApi: View {
    var ukuran: CGFloat = 32
    var body: some View {
        Image(systemName: "flame.fill")
            .font(.system(size: ukuran * 0.55))
            .foregroundStyle(Color.sukaInk)
            .frame(width: ukuran, height: ukuran)
            .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: ukuran * 0.28))
    }
}

private struct JudulMerek: View {
    let judul: String
    let sub: String
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(judul).font(SukaFont.lilita(15)).tracking(0.5).foregroundStyle(Color.sukaCreamTeks)
            Text(sub).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaOrange)
        }
    }
}

/// Avatar "SK" (area sentuh 48pt, lingkaran 36pt).
struct AvatarProfil: View {
    let aksi: () -> Void
    var body: some View {
        Button(action: aksi) {
            Text("SK")
                .font(SukaFont.jakarta(12, weight: .bold))
                .foregroundStyle(Color.sukaInk)
                .frame(width: 36, height: 36)
                .background(Color.sukaOrange, in: Circle())
                .frame(width: 48, height: 48)
        }
        .buttonStyle(.mentul(0.94))
        .accessibilityLabel("Profil")
    }
}

/// 1. Kepala Beranda: logo, lonceng, avatar, dan kartu outlet.
struct HomeBrandHeader: View {
    let namaOutlet: String
    let buka: Bool
    var unreadCount = 0
    let onGantiOutlet: () -> Void
    let onBukaProfil: () -> Void
    let onBukaNotifikasi: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                HStack(spacing: 8) {
                    LogoApi()
                    JudulMerek(judul: "SUKA SHAWARMA", sub: "Otentik • Panggang • Gurih")
                }
                Spacer()
                Button(action: onBukaNotifikasi) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.sukaCreamTeks)
                        .frame(width: 36, height: 36)
                        .background(Color.white.opacity(0.12), in: Circle())
                        .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 1))
                        .overlay(alignment: .topTrailing) {
                            if unreadCount > 0 {
                                Circle().fill(Color.sukaOrange).frame(width: 6, height: 6).padding(5)
                            }
                        }
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.mentul(0.92))
                .accessibilityLabel(unreadCount > 0 ? "Notifikasi, \(unreadCount) belum dibaca" : "Notifikasi")
                .accessibilityIdentifier("tombol-notifikasi")
                AvatarProfil(aksi: onBukaProfil)
            }

            Button(action: onGantiOutlet) {
                HStack {
                    HStack(spacing: 8) {
                        Image(systemName: "mappin")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.sukaOrange)
                            .frame(width: 28, height: 28)
                            .background(Color.sukaOrange.opacity(0.15), in: Circle())
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: 4) {
                                Text(namaOutlet)
                                    .font(SukaFont.jakarta(13, weight: .bold))
                                    .foregroundStyle(Color.sukaInk)
                                    .lineLimit(1)
                                Circle().fill(buka ? Color.sukaGreen : Color.sukaMuted).frame(width: 4, height: 4)
                                Text(buka ? "Buka" : "Tutup")
                                    .font(SukaFont.jakarta(11, weight: .bold))
                                    .foregroundStyle(buka ? Color.sukaGreen : Color.sukaMuted)
                            }
                            Text(buka ? "Siap saji dalam 15–20 menit" : "Tidak menerima pesanan")
                                .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        }
                    }
                    Spacer(minLength: 8)
                    HStack(spacing: 2) {
                        Text("Ganti").font(SukaFont.jakarta(11, weight: .bold))
                        Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(Color.sukaBrown)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.sukaOrange.opacity(0.3), lineWidth: 1))
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .kartuSuka(sudut: 14, elevasi: 3)
            }
            .buttonStyle(.mentul(0.98))
            .accessibilityHint("Ganti outlet")
            .accessibilityIdentifier("ganti-outlet")
        }
        .padding(.horizontal, 16)
        .padding(.top, 8).padding(.bottom, 12)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(LatarKepala())
    }
}

/// 2. Kepala tab Menu: pil outlet, avatar, kolom cari, dan (opsional) chip kategori.
struct MenuBrandHeader<Kategori: View>: View {
    let namaOutlet: String
    @Binding var kueri: String
    let onGantiOutlet: () -> Void
    let onBukaProfil: () -> Void
    @ViewBuilder var kategori: () -> Kategori

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                HStack(spacing: 8) {
                    LogoApi()
                    JudulMerek(judul: "MENU & KATALOG", sub: "Pilihan Shawarma Otentik")
                }
                Spacer(minLength: 8)
                Button(action: onGantiOutlet) {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.sukaOrange)
                        Text(namaOutlet).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                        Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.white.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.25), lineWidth: 1))
                }
                .buttonStyle(.mentul())
                .accessibilityLabel("Outlet \(namaOutlet), ganti outlet")
                AvatarProfil(aksi: onBukaProfil)
            }
            .padding(.horizontal, 16)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(Color.sukaMuted)
                TextField("", text: $kueri, prompt: Text("Cari menu favorit, shawarma, saus...").foregroundStyle(Color.sukaMuted))
                    .font(SukaFont.jakarta(13, weight: .medium))
                    .foregroundStyle(Color.sukaInk)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                if !kueri.isEmpty {
                    Button { kueri = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(Color.sukaMuted)
                    }
                    .accessibilityLabel("Hapus pencarian")
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 42)
            .kartuSuka(sudut: 12, elevasi: 2)
            .padding(.horizontal, 16)

            kategori()
        }
        .padding(.top, 8).padding(.bottom, 10)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(LatarKepala())
    }
}

/// 3. Kepala halaman biasa (detail, riwayat, profil): kembali/logo, judul, aksi kanan.
struct PageBrandHeader<AksiKanan: View>: View {
    let judul: String
    var subjudul: String?
    var onKembali: (() -> Void)?
    @ViewBuilder var aksiKanan: () -> AksiKanan

    var body: some View {
        HStack {
            if let onKembali {
                Button(action: onKembali) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.sukaCreamTeks)
                        .frame(width: 34, height: 34)
                        .background(Color.white.opacity(0.15), in: Circle())
                        .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 1))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.mentul())
                .accessibilityLabel("Kembali")
            } else {
                LogoApi(ukuran: 34).frame(width: 44, height: 44)
            }

            VStack(spacing: 0) {
                Text(judul).font(SukaFont.lilita(17)).tracking(0.5).foregroundStyle(Color.sukaCreamTeks).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                if let subjudul {
                    Text(subjudul).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaOrange).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)

            aksiKanan().frame(minWidth: 44, minHeight: 44)
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(LatarKepala())
    }
}

extension PageBrandHeader where AksiKanan == EmptyView {
    init(judul: String, subjudul: String? = nil, onKembali: (() -> Void)? = nil) {
        self.init(judul: judul, subjudul: subjudul, onKembali: onKembali) { EmptyView() }
    }
}
