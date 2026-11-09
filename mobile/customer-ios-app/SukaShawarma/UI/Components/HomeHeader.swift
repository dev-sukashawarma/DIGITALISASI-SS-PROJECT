import SwiftUI

/// Padanan `ui/components/HomeHeader.kt`: tiga kepala cokelat melengkung.

private let bentukKepala = UnevenRoundedRectangle(bottomLeadingRadius: 26, bottomTrailingRadius: 26)

private struct LatarKepala: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background {
                bentukKepala.fill(SukaGradien.kepala)
                    .bayangan(4)
                    .ignoresSafeArea(edges: .top)
            }
    }
}

/// Logo Suka Shawarma asli (dulu ikon api oranye).
private struct LogoSuka: View {
    var ukuran: CGFloat = 38
    var body: some View {
        Image("LogoSuka")
            .resizable().scaledToFit()
            .frame(width: ukuran, height: ukuran)
            .clipShape(RoundedRectangle(cornerRadius: ukuran * 0.26))
            .overlay(RoundedRectangle(cornerRadius: ukuran * 0.26).stroke(Color.white.opacity(0.18), lineWidth: 1))
            .accessibilityLabel("Logo Suka Shawarma")
    }
}

/// Jarak bawah kepala SAAT ada baris chip di bawah judul — satu nilai untuk
/// semua kepala supaya jarak napas di bawah chip konsisten antar halaman.
private let jarakBawahKepalaDenganKonten: CGFloat = 14

/// Chip filter/kategori di atas latar cokelat — dipakai bersama kategori Menu
/// & filter status Pesanan supaya keduanya satu sistem, bukan dua gaya.
struct HeaderChip: View {
    let label: String
    let dipilih: Bool
    let aksi: () -> Void

    var body: some View {
        Button(action: aksi) {
            Text(label)
                .font(SukaFont.jakarta(12, weight: dipilih ? .bold : .medium))
                .foregroundStyle(dipilih ? Color.sukaInk : Color.sukaCreamTeks)
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background {
                    if dipilih {
                        Capsule().fill(SukaGradien.oranyePrimer)
                            .shadow(color: Color.sukaOrange.opacity(0.3), radius: 4, y: 1)
                    } else {
                        Capsule().fill(Color.white.opacity(0.14))
                    }
                }
                .overlay(Capsule().stroke(dipilih ? Color.clear : Color.white.opacity(0.22), lineWidth: 1))
        }
        .buttonStyle(.mentul(0.94))
        .accessibilityAddTraits(dipilih ? .isSelected : [])
    }
}

private struct JudulMerek: View {
    let judul: String
    let sub: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(judul).font(SukaFont.lilita(16)).tracking(0.5).foregroundStyle(Color.sukaCreamTeks)
            Text(sub).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaOrange)
        }
    }
}

/// Avatar inisial pelanggan (area sentuh 48pt, lingkaran 36pt). `inisial` dari
/// `inisialNama()` — dulu "SK" ditulis mati untuk semua orang.
struct AvatarProfil: View {
    var inisial = "?"
    let aksi: () -> Void
    var body: some View {
        Button(action: aksi) {
            ZStack {
                Circle()
                    .fill(SukaGradien.oranyePrimer)
                    .frame(width: 36, height: 36)
                    .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 1.5))
                Text(inisial)
                    .font(SukaFont.jakarta(13, weight: .bold))
                    .foregroundStyle(Color.sukaInk)
            }
            .frame(width: 48, height: 48)
        }
        .buttonStyle(.mentul(0.92))
        .accessibilityLabel("Profil")
    }
}

/// 1. Kepala Beranda: logo, lonceng, avatar, dan kartu outlet.
struct HomeBrandHeader: View {
    let namaOutlet: String
    let buka: Bool
    /// Keterangan di bawah nama outlet saat TIDAK bisa pesan (jam tutup, tutup
    /// sementara) — `labelStatusOutlet(outlet)`. Nil = "Tidak menerima pesanan".
    var keteranganTutup: String?
    var unreadCount = 0
    var inisial = "?"
    let onGantiOutlet: () -> Void
    let onBukaProfil: () -> Void
    let onBukaNotifikasi: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                HStack(spacing: 10) {
                    LogoSuka(ukuran: 38)
                    JudulMerek(judul: "SUKA SHAWARMA", sub: "Besar dan Nikmat")
                }
                Spacer()
                Button(action: onBukaNotifikasi) {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.sukaCreamTeks)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.12), in: Circle())
                            .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 1))
                        if unreadCount > 0 {
                            Circle()
                                .fill(Color.sukaOrange)
                                .frame(width: 8, height: 8)
                                .overlay(Circle().stroke(Color.sukaBrownDark, lineWidth: 1.5))
                                .offset(x: 1, y: -1)
                        }
                    }
                    .frame(width: 48, height: 48)
                }
                .buttonStyle(.mentul(0.92))
                .accessibilityLabel(unreadCount > 0 ? "Notifikasi, \(unreadCount) belum dibaca" : "Notifikasi")
                .accessibilityIdentifier("tombol-notifikasi")
                AvatarProfil(inisial: inisial, aksi: onBukaProfil)
            }

            Button(action: onGantiOutlet) {
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 11)
                            .fill(Color.sukaTint)
                            .frame(width: 36, height: 36)
                        Image(systemName: "mappin.and.ellipse")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.sukaOrange)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(namaOutlet)
                                .font(SukaFont.jakarta(13, weight: .bold))
                                .foregroundStyle(Color.sukaInk)
                                .lineLimit(1)
                            HStack(spacing: 3) {
                                Circle().fill(buka ? Color.sukaGreen : Color.sukaMuted).frame(width: 5, height: 5)
                                Text(buka ? "Buka" : "Tutup")
                                    .font(SukaFont.jakarta(10, weight: .bold))
                                    .foregroundStyle(buka ? Color.sukaGreen : Color.sukaMuted)
                            }
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background((buka ? Color.sukaGreen : Color.sukaMuted).opacity(0.12), in: Capsule())
                        }
                        // Bukan janji waktu saji — belum ada data per outlet.
                        Text(buka ? "Ambil sendiri di outlet ini" : (keteranganTutup ?? "Tidak menerima pesanan"))
                            .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    HStack(spacing: 3) {
                        Text("Ganti").font(SukaFont.jakarta(11, weight: .bold))
                        Image(systemName: "chevron.right").font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(Color.sukaBrown)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Color.sukaTint, in: Capsule())
                    .overlay(Capsule().stroke(Color.sukaOrange.opacity(0.3), lineWidth: 1))
                }
                .padding(.horizontal, 12).padding(.vertical, 9)
                .kartuElegan(sudut: 16, elevasi: 3, latar: .white)
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
    var inisial = "?"
    let onGantiOutlet: () -> Void
    let onBukaProfil: () -> Void
    @ViewBuilder var kategori: () -> Kategori

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                HStack(spacing: 8) {
                    LogoSuka(ukuran: 36)
                    JudulMerek(judul: "MENU & KATALOG", sub: "Pilihan Shawarma Otentik")
                }
                Spacer(minLength: 8)
                Button(action: onGantiOutlet) {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.sukaOrange)
                        Text(namaOutlet).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                        Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(.white)
                    }
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(Color.white.opacity(0.15), in: Capsule())
                    .overlay(Capsule().stroke(Color.white.opacity(0.25), lineWidth: 1))
                }
                .buttonStyle(.mentul())
                .accessibilityLabel("Outlet \(namaOutlet), ganti outlet")
                AvatarProfil(inisial: inisial, aksi: onBukaProfil)
            }
            .padding(.horizontal, 16)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.sukaMuted)
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
            .padding(.horizontal, 14)
            .frame(height: 42)
            .kartuElegan(sudut: 13, elevasi: 2, latar: .white)
            .padding(.horizontal, 16)

            kategori()
        }
        .padding(.top, 8).padding(.bottom, jarakBawahKepalaDenganKonten)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(LatarKepala())
    }
}

/// 3. Kepala halaman biasa (detail, riwayat, profil): kembali/logo, judul, aksi kanan.
struct PageBrandHeader<AksiKanan: View, Bawah: View>: View {
    let judul: String
    var subjudul: String?
    var onKembali: (() -> Void)?
    @ViewBuilder var aksiKanan: () -> AksiKanan
    /// Baris tambahan di bawah judul (mis. filter status Pesanan) — di dalam
    /// latar cokelat yang sama, seperti chip kategori di kepala Menu.
    @ViewBuilder var bawah: () -> Bawah

    var body: some View {
        VStack(spacing: 10) {
            barisJudul
            if Bawah.self != EmptyView.self { bawah() }
        }
        .padding(.top, 6)
        .padding(.bottom, Bawah.self != EmptyView.self ? jarakBawahKepalaDenganKonten : 8)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .modifier(LatarKepala())
    }

    private var barisJudul: some View {
        HStack {
            if let onKembali {
                Button(action: onKembali) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.sukaCreamTeks)
                        .frame(width: 36, height: 36)
                        .background(Color.white.opacity(0.15), in: Circle())
                        .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 1))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.mentul())
                .accessibilityLabel("Kembali")
            } else {
                LogoSuka(ukuran: 36).frame(width: 44, height: 44)
            }

            VStack(spacing: 1) {
                Text(judul).font(SukaFont.lilita(18)).tracking(0.5).foregroundStyle(Color.sukaCreamTeks).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                if let subjudul {
                    Text(subjudul).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaOrange).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)

            aksiKanan().frame(minWidth: 44, minHeight: 44)
        }
        .padding(.horizontal, 12)
    }
}

extension PageBrandHeader where Bawah == EmptyView {
    init(judul: String, subjudul: String? = nil, onKembali: (() -> Void)? = nil,
         @ViewBuilder aksiKanan: @escaping () -> AksiKanan) {
        self.init(judul: judul, subjudul: subjudul, onKembali: onKembali, aksiKanan: aksiKanan) { EmptyView() }
    }
}

extension PageBrandHeader where AksiKanan == EmptyView, Bawah == EmptyView {
    init(judul: String, subjudul: String? = nil, onKembali: (() -> Void)? = nil) {
        self.init(judul: judul, subjudul: subjudul, onKembali: onKembali) { EmptyView() } bawah: { EmptyView() }
    }
}
