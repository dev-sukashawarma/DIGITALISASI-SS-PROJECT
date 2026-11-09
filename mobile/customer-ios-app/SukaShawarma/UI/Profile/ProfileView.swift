import SwiftUI

/// Padanan `ui/profile/ProfileScreen.kt` — tab Profil.
///
/// Beda sengaja dengan Android (lihat RANCANGAN.md §8 Fase 5): statistik
/// dihitung dari data nyata (Android membuang statistiknya karena angkanya
/// karangan). Menu bantuan hanya tampil bila tautannya diisi di Pengaturan
/// Aplikasi admin — sama dengan Android sejak 24 Sep.
struct ProfileView: View {
    let sesi: SessionData?
    let jumlahSelesai: Int?
    let namaOutlet: String?
    let notificationStore: NotificationStore
    let onSimpanPreferensi: (Bool, Bool) -> Void
    let onBukaInfoAkun: () -> Void
    let onBukaVoucher: () -> Void
    let onLihatRiwayat: () -> Void
    let onMasuk: () -> Void
    let onKeluar: () -> Void

    @Environment(\.configApp) private var config
    @Environment(\.openURL) private var bukaUrl
    @State private var tampilPengaturan = false
    @State private var konfirmasiKeluar = false

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Akun Saya", subjudul: "Profil & Pengaturan Akun")
            ScrollView {
                VStack(spacing: 16) {
                    if let sesi { kartuAkun(sesi) } else { kartuTamu }
                    if sesi != nil { statistik }

                    bagian("PENGATURAN AKUN") {
                        if sesi != nil {
                            ItemMenu(ikon: "list.bullet.rectangle.portrait.fill", judul: "Riwayat Pesanan",
                                     sub: "Pantau status & pesanan sebelumnya", aksi: onLihatRiwayat)
                            Divider().padding(.leading, 60)
                            ItemMenu(ikon: "tag.fill", judul: "Voucher Saya",
                                     sub: "Promo yang bisa kamu pakai", aksi: onBukaVoucher)
                            Divider().padding(.leading, 60)
                            ItemMenu(ikon: "person.fill", judul: "Informasi Akun",
                                     sub: sesi?.email ?? "Akun Pelanggan", aksi: onBukaInfoAkun)
                            Divider().padding(.leading, 60)
                        }
                        ItemMenu(ikon: "bell.fill", judul: "Pengaturan Notifikasi",
                                 sub: "Preferensi status pesanan & promo") { tampilPengaturan = true }
                    }

                    if !tautanBantuan.isEmpty {
                        bagian("BANTUAN & INFORMASI") {
                            ForEach(Array(tautanBantuan.enumerated()), id: \.offset) { i, t in
                                if i > 0 { Divider().padding(.leading, 60) }
                                ItemMenu(ikon: t.ikon, judul: t.judul, sub: t.sub) { bukaUrl(t.url) }
                            }
                        }
                    }

                    if sesi != nil {
                        Button { konfirmasiKeluar = true } label: {
                            Label("Keluar dari Akun", systemImage: "rectangle.portrait.and.arrow.right")
                                .font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaMerah)
                                .frame(maxWidth: .infinity, minHeight: 50)
                                .background(Color(hex: 0xFEF2F2), in: RoundedRectangle(cornerRadius: 16))
                        }
                        .buttonStyle(.mentul(0.98))
                    }

                    VStack(spacing: 2) {
                        Text("Suka Shawarma iOS v\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")")
                            .font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaMuted)
                        Text("Rasa Autentik Cepat Saji").font(SukaFont.jakarta(10)).foregroundStyle(Color.sukaMuted)
                    }
                    .padding(.top, 4)
                }
                .padding(16).padding(.bottom, 80)
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .sheet(isPresented: $tampilPengaturan) {
            let p = notificationStore.bacaPreferensi()
            PengaturanNotifikasiSheet(statusPesanan: p.statusPesanan, promo: p.promo, onSimpan: onSimpanPreferensi)
        }
        .confirmationDialog("Keluar dari akun?", isPresented: $konfirmasiKeluar, titleVisibility: .visible) {
            Button("Keluar", role: .destructive, action: onKeluar)
        } message: {
            Text("Keranjangmu tetap tersimpan di HP ini.")
        }
    }

    /// Baris tautan hanya untuk setelan yang terisi — tombol mati terbaca rusak.
    private var tautanBantuan: [(ikon: String, judul: String, sub: String, url: URL)] {
        var hasil: [(ikon: String, judul: String, sub: String, url: URL)] = []
        if let wa = tautanWa(config.waCs, teks: "Halo CS Suka Shawarma") {
            hasil.append(("headphones", "Hubungi CS", "Chat lewat WhatsApp", wa))
        }
        if let url = tautanWeb(config.urlPrivasi) {
            hasil.append(("lock.shield.fill", "Kebijakan Privasi", "Keamanan data pelanggan Suka Shawarma", url))
        }
        if let url = tautanWeb(config.urlSyarat) {
            hasil.append(("doc.text.fill", "Syarat & Ketentuan", "Ketentuan pemesanan & pengambilan", url))
        }
        return hasil
    }

    private func kartuAkun(_ s: SessionData) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(SukaGradien.oranyePrimer)
                        .frame(width: 58, height: 58)
                        .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 2))
                    Text(inisialNama(s.nama, email: s.email))
                        .font(SukaFont.lilita(22))
                        .foregroundStyle(Color.sukaInk)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(InformasiAkun.teksAtauNil(s.nama) ?? "Pelanggan Suka")
                        .font(SukaFont.jakarta(17, weight: .bold))
                        .foregroundStyle(Color.sukaInk)
                    Text(s.email ?? "Belum ada email")
                        .font(SukaFont.jakarta(12))
                        .foregroundStyle(Color.sukaMuted)
                }
                Spacer()
            }
            if let tel = InformasiAkun.teksAtauNil(s.telepon) {
                HStack(spacing: 8) {
                    Image(systemName: "phone.fill").font(.system(size: 13)).foregroundStyle(Color.sukaOrange)
                    Text(ProfilForm.untukIsian(tel)).font(SukaFont.jakarta(13, weight: .medium)).foregroundStyle(Color.sukaInk)
                    Spacer()
                }
                .padding(12)
                .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 12))
            } else {
                Text("Nomor HP belum ditambahkan. Tidak wajib untuk memesan; nanti diperlukan saat program referral dibuka.")
                    .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(16)
        .kartuElegan(sudut: 22, elevasi: 2, latar: .white)
    }

    private var kartuTamu: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(SukaGradien.oranyePrimer)
                    .frame(width: 58, height: 58)
                Text("SS").font(SukaFont.lilita(22)).foregroundStyle(Color.sukaInk)
            }
            Text("Belum Masuk").font(SukaFont.jakarta(16, weight: .bold)).foregroundStyle(Color.sukaInk)
            Text("Masuk untuk melihat riwayat pesanan dan mengatur akunmu.")
                .font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted).multilineTextAlignment(.center)
            TombolUtama(label: "Masuk Sekarang", aksi: onMasuk)
        }
        .padding(20).frame(maxWidth: .infinity)
        .kartuElegan(sudut: 22, elevasi: 2, latar: .white)
    }

    /// Angka NYATA: jumlah pesanan selesai dari riwayat, dan outlet yang sedang
    /// dipilih. Android menampilkan "12" dan "Bogor Pajajaran" untuk semua orang.
    private var statistik: some View {
        HStack(spacing: 12) {
            kotakStat(jumlahSelesai.map(String.init) ?? "–", "Pesanan Selesai", ikon: "bag.fill")
            kotakStat(namaOutlet ?? "–", "Outlet Pilihan", ikon: "mappin.circle.fill")
        }
    }

    private func kotakStat(_ nilai: String, _ label: String, ikon: String) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: ikon).font(.system(size: 13)).foregroundStyle(Color.sukaOrange)
                Text(nilai).font(SukaFont.lilita(19)).foregroundStyle(Color.sukaBrown).lineLimit(1).minimumScaleFactor(0.6)
            }
            Text(label).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
        }
        .padding(14).frame(maxWidth: .infinity)
        .kartuElegan(sudut: 16, elevasi: 1, latar: .white)
    }

    private func bagian(_ judul: String, @ViewBuilder isi: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(judul).font(SukaFont.jakarta(11, weight: .bold)).tracking(0.6).foregroundStyle(Color.sukaMuted).padding(.leading, 4)
            VStack(spacing: 0) { isi() }.kartuElegan(sudut: 18, elevasi: 1, latar: .white)
        }
    }
}

private struct ItemMenu: View {
    let ikon: String
    let judul: String
    let sub: String
    let aksi: () -> Void

    var body: some View {
        Button(action: aksi) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.sukaTint)
                        .frame(width: 36, height: 36)
                    Image(systemName: ikon).font(.system(size: 15)).foregroundStyle(Color.sukaBrown)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(judul).font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                    Text(sub).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted).lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.sukaMuted.opacity(0.7))
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.mentul(0.98))
        .accessibilityIdentifier("menu-\(judul)")
    }
}
