import SwiftUI

/// Padanan `ui/orders/OrderStatusScreen.kt`: status dapur langsung + nomor kasir.
struct OrderStatusView: View {
    @State var vm: OrderStatusViewModel
    let onKembali: () -> Void
    @Environment(\.configApp) private var config

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                tombolBulat("chevron.left", label: "Kembali", aksi: onKembali)
                Spacer()
                VStack(spacing: 0) {
                    Text("Status Pesanan").font(SukaFont.jakarta(17, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    Text("Ambil Mandiri di Outlet").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                }
                Spacer()
                tombolBulat("arrow.clockwise", label: "Muat ulang") { Task { await vm.ambil() } }
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            isi.frame(maxHeight: .infinity)
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .latarBilahStatus()
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.pantau() }
    }

    private func tombolBulat(_ ikon: String, label: String, aksi: @escaping () -> Void) -> some View {
        Button(action: aksi) {
            Image(systemName: ikon).font(.system(size: 15, weight: .bold)).foregroundStyle(Color.sukaBrown)
                .frame(width: 40, height: 40).background(Color.white, in: Circle())
        }
        .buttonStyle(.mentul())
        .accessibilityLabel(label)
    }

    @ViewBuilder private var isi: some View {
        if vm.memuat && vm.pesanan == nil {
            MemuatState()
        } else if let p = vm.pesanan {
            konten(p, p.tampilan)
        } else if let g = vm.galat {
            ErrorState(galat: g) { Task { await vm.ambil() } }
        }
    }

    private func judulBesar(_ t: TampilanStatus) -> String {
        switch t.tahap {
        case .diterima: "Pesanan Diterima!"
        case .dibuat: "Shawarma Kamu Sedang Dibuat!"
        case .siap: t.selesai ? "Pesanan Sudah Diambil" : "Pesanan Siap Diambil! 🎉"
        case nil: t.judul
        }
    }

    private func estimasi(_ t: TampilanStatus) -> String {
        switch t.tahap {
        case .diterima: "Estimasi Siap: ~\(config.estimasiSiap)"
        case .dibuat: "Estimasi Siap: ~5-10 mnt"
        case .siap: t.selesai ? "Selesai" : "Siap Diambil Sekarang!"
        case nil: "Menunggu"
        }
    }

    private func konten(_ p: OrderDetailDto, _ t: TampilanStatus) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        if t.berjalan {
                            HStack(spacing: 5) {
                                Circle().fill(Color.white).frame(width: 6, height: 6)
                                    .phaseAnimator([0.4, 1.0]) { v, a in v.opacity(a) } animation: { _ in .easeInOut(duration: 0.8) }
                                Text("LIVE DARI DAPUR").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(.white)
                            }
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(SukaGradien.oranyePrimer, in: Capsule())
                            .shadow(color: Color.sukaOrange.opacity(0.35), radius: 3, y: 1)
                        }
                        Spacer()
                        if t.selesai {
                            Text("Selesai").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaGreen)
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(Color.sukaGreen.opacity(0.12), in: Capsule())
                        }
                    }
                    Text(judulBesar(t)).font(SukaFont.lilita(24)).foregroundStyle(t.dibatalkan ? Color.sukaMerah : Color.sukaBrown)
                        .accessibilityIdentifier("judul-status")
                    Text(t.penjelasan).font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted)
                    if !t.dibatalkan && !t.tidakDiproses {
                        HStack {
                            Label(estimasi(t), systemImage: "clock").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaBrown)
                            Spacer()
                            Text("Self-Pickup").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaMuted)
                        }
                        ProgressView(value: t.tahap.map { Double($0.rawValue + 1) / 3 } ?? 0.1)
                            .tint(Color.sukaOrange)
                            .animation(.easeInOut, value: t.tahap)
                    }
                }
                .padding(18)
                .kartuElegan(sudut: 22, elevasi: 3, latar: .white)

                VStack(spacing: 6) {
                    Text("NOMOR PESANAN KASIR").font(SukaFont.jakarta(11, weight: .bold)).tracking(1.0).foregroundStyle(Color.sukaMuted)
                    Text(p.posOrderNumber.map { "#\($0)" } ?? "#-")
                        .font(SukaFont.lilita(46))
                        .foregroundStyle(Color.sukaBrown)
                    if let o = p.outletName {
                        Label(o, systemImage: "storefront.fill").font(SukaFont.jakarta(13, weight: .semibold)).foregroundStyle(Color.sukaInk)
                    }
                }
                .padding(20).frame(maxWidth: .infinity)
                .background {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(LinearGradient(colors: [Color(hex: "FFF8F2"), Color(hex: "FFF2E6")], startPoint: .topLeading, endPoint: .bottomTrailing))
                }
                .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Color.sukaOrange.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
                .shadow(color: Color.sukaOrange.opacity(0.08), radius: 6, y: 2)

                if !t.dibatalkan && !t.tidakDiproses {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Tahapan Pesanan").font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk).padding(.bottom, 12)
                        LangkahWaktu(judul: "Pesanan Diterima", ket: "Kasir telah menerima & memvalidasi pesananmu",
                                     tahap: .diterima, sekarang: t, terakhir: false)
                        LangkahWaktu(judul: "Sedang Dimasak", ket: "Dapur sedang memanggang ayam & menggulung segar",
                                     tahap: .dibuat, sekarang: t, terakhir: false)
                        LangkahWaktu(judul: "Siap Diambil", ket: "Langsung menuju counter Online Pickup tanpa antre",
                                     tahap: .siap, sekarang: t, terakhir: true)
                    }
                    .padding(18)
                    .kartuElegan(sudut: 20, elevasi: 2, latar: .white)
                }

                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Total Pembayaran").font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted)
                        let bayar = labelPembayaran(statusDapur: p.statusDapur, statusDraft: p.status)
                        Text(bayar.teks)
                            .font(SukaFont.jakarta(12, weight: .bold))
                            .foregroundStyle(bayar.lunas ? Color.sukaGreen : Color.sukaMuted)
                    }
                    Spacer()
                    Text(rupiah(p.totalAmount)).font(SukaFont.lilita(22)).foregroundStyle(Color.sukaBrown)
                }
                .padding(16)
                .kartuElegan(sudut: 18, elevasi: 1, latar: .white)

                // Pesanan dibatalkan: jalur tanya pengembalian dana ke CS.
                if t.dibatalkan, let tautan = tautanWa(config.waCs, teks:
                    "Pesanan #\(p.posOrderNumber.map(String.init) ?? "-") dibatalkan, saya ingin menanyakan pengembalian dana.") {
                    Link(destination: tautan) {
                        Label("Hubungi CS", systemImage: "headphones")
                            .font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Color.sukaGreen, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.mentul(0.98))
                    .accessibilityIdentifier("tombol-hubungi-cs")
                }
            }
            .padding(16)
        }
        .refreshable { await vm.ambil() }
    }
}

private struct LangkahWaktu: View {
    let judul: String
    let ket: String
    let tahap: TahapPesanan
    let sekarang: TampilanStatus
    let terakhir: Bool

    var body: some View {
        let aktif = sekarang.tahap == tahap && !sekarang.selesai
        let tercapai = tahapTercapai(sekarang.tahap, tahap)
        let selesai = tercapai && !aktif
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                ZStack {
                    Circle().fill(selesai ? Color.sukaGreen : aktif ? Color.sukaOrange : Color(hex: 0xF3F4F6))
                    if selesai {
                        Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                    } else if aktif {
                        Circle().fill(Color.white).frame(width: 8, height: 8)
                    }
                }
                .frame(width: 24, height: 24)
                if !terakhir {
                    Rectangle().fill(tercapai ? Color.sukaGreen : Color(hex: 0xE5E7EB)).frame(width: 2).frame(minHeight: 28)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(judul).font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(tercapai ? Color.sukaInk : Color.sukaMuted)
                Text(ket).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
            }
            .padding(.bottom, terakhir ? 0 : 12)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(selesai ? "selesai" : aktif ? "sedang berjalan" : "belum")
    }
}
