import SwiftUI

/// Padanan `ui/orders/HistoryScreen.kt` — tab Pesanan.
struct HistoryView: View {
    @State var vm: HistoryViewModel
    let onBukaPesanan: (String) -> Void
    let onBukaProfil: () -> Void
    let onMasuk: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                PageBrandHeader(judul: "Riwayat Pesanan", subjudul: "Pantau status & riwayat pesananmu") {
                    AvatarProfil(aksi: onBukaProfil)
                }
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(FilterRiwayat.allCases, id: \.self) { f in
                            let pilih = vm.filter == f
                            Button { vm.filter = f } label: {
                                Text(f.label).font(SukaFont.jakarta(12, weight: pilih ? .bold : .medium))
                                    .foregroundStyle(pilih ? Color.sukaBrown : Color.sukaInk)
                                    .padding(.horizontal, 14).padding(.vertical, 7)
                                    .background(pilih ? Color.sukaOrange : .white, in: Capsule())
                                    .overlay(Capsule().stroke(pilih ? .clear : Color.sukaBorder, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(pilih ? .isSelected : [])
                        }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 10)
                }
                .scrollIndicators(.hidden)
            }
            isi.frame(maxHeight: .infinity)
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .task { await vm.muat() }
    }

    @ViewBuilder private var isi: some View {
        if vm.memuat {
            MemuatState()
        } else if case .sesiTidakSah? = vm.galat {
            EmptyState(judul: "Masuk dulu", penjelasan: "Riwayat pesanan tersimpan di akunmu. Masuk untuk melihatnya.",
                       tombol: ("Masuk", onMasuk))
        } else if let g = vm.galat, vm.pesanan.isEmpty {
            ErrorState(galat: g) { Task { await vm.muat() } }
        } else if vm.pesanan.isEmpty {
            EmptyState(judul: "Belum Ada Pesanan", penjelasan: "Pesanan yang sudah kamu bayar akan muncul di sini.")
        } else if vm.tampil.isEmpty {
            EmptyState(judul: "Tidak Ada Pesanan", penjelasan: "Tidak ada pesanan untuk kategori filter ini.")
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(vm.tampil) { p in
                        let t = tampilanStatus(p.statusDapur)
                        if t.berjalan {
                            KartuPesananAktif(pesanan: p, tampil: t) { onBukaPesanan(p.id) }
                        } else {
                            KartuPesanan(pesanan: p, tampil: t) { onBukaPesanan(p.id) }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 96)
            }
            .refreshable { await vm.muat() }
        }
    }
}

private struct KartuPesananAktif: View {
    let pesanan: OrderDetailDto
    let tampil: TampilanStatus
    let onKlik: () -> Void

    var body: some View {
        Button(action: onKlik) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    HStack(spacing: 6) {
                        Circle().fill(Color.sukaOrange).frame(width: 8, height: 8)
                            .phaseAnimator([0.4, 1.0]) { v, a in v.opacity(a) } animation: { _ in .easeInOut(duration: 0.9) }
                        Text(tampil.judul).font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Color.sukaTint, in: Capsule())
                    Spacer()
                    Text(pesanan.posOrderNumber.map { "#\($0)" } ?? "#SS").font(SukaFont.lilita(22)).foregroundStyle(Color.sukaBrown)
                }
                if let outlet = pesanan.outletName {
                    Label(outlet, systemImage: "storefront.fill").font(SukaFont.jakarta(13, weight: .medium)).foregroundStyle(Color.sukaInk)
                }
                if let w = formatWaktuPendek(pesanan.createdAt) {
                    Text(w).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                }
                Rectangle().fill(Color(hex: 0xF5EADB)).frame(height: 1)
                HStack {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Total Pembayaran").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        Text(rupiah(pesanan.totalAmount)).font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    }
                    Spacer()
                    HStack(spacing: 4) {
                        Text("Lihat Status").font(SukaFont.jakarta(12, weight: .bold))
                        Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(Color.sukaInk)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.sukaOrange, in: Capsule())
                }
            }
            .padding(16)
            .kartuSuka(sudut: 20, elevasi: 3, tepi: .sukaOrange.opacity(0.5))
        }
        .buttonStyle(.mentul(0.98))
    }
}

private struct KartuPesanan: View {
    let pesanan: OrderDetailDto
    let tampil: TampilanStatus
    let onKlik: () -> Void

    private var warna: (latar: Color, teks: Color) {
        if tampil.selesai { return (Color(hex: 0xECFDF5), .sukaGreen) }
        if tampil.dibatalkan { return (Color(hex: 0xFEF2F2), .sukaMerah) }
        return (Color(hex: 0xFFF4EB), .sukaOrangeTeks)
    }

    var body: some View {
        Button(action: onKlik) {
            HStack(spacing: 12) {
                Image(systemName: "list.bullet.rectangle.portrait").font(.system(size: 18)).foregroundStyle(Color.sukaBrown)
                    .frame(width: 44, height: 44).background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(pesanan.posOrderNumber.map { "Pesanan #\($0)" } ?? "Pesanan")
                            .font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                        Text(tampil.judul).font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(warna.teks)
                            .padding(.horizontal, 8).padding(.vertical, 2).background(warna.latar, in: Capsule())
                    }
                    if let outlet = pesanan.outletName {
                        Text(outlet).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted).lineLimit(1)
                    }
                    if let w = formatWaktuPendek(pesanan.createdAt) {
                        Text(w).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                    Text(rupiah(pesanan.totalAmount)).font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaBrown)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.sukaMuted)
            }
            .padding(14)
            .kartuSuka(sudut: 18, elevasi: 1)
        }
        .buttonStyle(.mentul(0.98))
    }
}
