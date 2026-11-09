import SwiftUI

/// Padanan `ui/orders/HistoryScreen.kt` — tab Pesanan.
struct HistoryView: View {
    @State var vm: HistoryViewModel
    let onBukaPesanan: (String) -> Void
    var inisial = "?"
    let onBukaProfil: () -> Void
    let onMasuk: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Riwayat Pesanan", subjudul: "Pantau status & riwayat pesananmu") {
                AvatarProfil(inisial: inisial, aksi: onBukaProfil)
            } bawah: {
                // Filter menyatu di dalam kepala cokelat — sama seperti kategori
                // di tab Menu, bukan baris terpisah di latar krem.
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(FilterRiwayat.allCases, id: \.self) { f in
                            HeaderChip(label: f.label, dipilih: vm.filter == f) { vm.filter = f }
                        }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 2)
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
                        let t = p.tampilan
                        if t.berjalan {
                            KartuPesananAktif(pesanan: p, tampil: t) { onBukaPesanan(p.id) }
                        } else {
                            KartuPesanan(pesanan: p, tampil: t) { onBukaPesanan(p.id) }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 96)
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
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    HStack(spacing: 6) {
                        Circle().fill(Color.sukaOrange).frame(width: 8, height: 8)
                            .phaseAnimator([0.4, 1.0]) { v, a in v.opacity(a) } animation: { _ in .easeInOut(duration: 0.9) }
                        Text(tampil.judul).font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(Color.sukaTint, in: Capsule())
                    Spacer()
                    Text(pesanan.posOrderNumber.map { "#\($0)" } ?? "#SS")
                        .font(SukaFont.lilita(24))
                        .foregroundStyle(Color.sukaBrown)
                }

                if let outlet = pesanan.outletName {
                    HStack(spacing: 6) {
                        Image(systemName: "storefront.fill").font(.system(size: 13)).foregroundStyle(Color.sukaOrange)
                        Text(outlet).font(SukaFont.jakarta(13, weight: .semibold)).foregroundStyle(Color.sukaInk)
                    }
                }
                if let w = formatWaktuPendek(pesanan.createdAt) {
                    Text(w).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                }

                Rectangle().fill(Color.black.opacity(0.06)).frame(height: 1)

                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Total Pembayaran").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        Text(rupiah(pesanan.totalAmount)).font(SukaFont.lilita(17)).foregroundStyle(Color.sukaBrown)
                    }
                    Spacer()
                    HStack(spacing: 4) {
                        Text("Lihat Status").font(SukaFont.jakarta(12, weight: .bold))
                        Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(Color.sukaInk)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(SukaGradien.oranyePrimer, in: Capsule())
                    .shadow(color: Color.sukaOrange.opacity(0.35), radius: 4, y: 1)
                }
            }
            .padding(16)
            .kartuElegan(sudut: 20, elevasi: 3, latar: .white)
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.sukaOrange.opacity(0.35), lineWidth: 1.5))
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
        if tampil.dibatalkan || tampil.tidakDiproses { return (Color(hex: 0xFEF2F2), .sukaMerah) }
        return (Color(hex: 0xFFF4EB), .sukaOrangeTeks)
    }

    var body: some View {
        Button(action: onKlik) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.sukaTint)
                        .frame(width: 44, height: 44)
                    Image(systemName: "list.bullet.rectangle.portrait")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.sukaBrown)
                }

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
                    Text(rupiah(pesanan.totalAmount)).font(SukaFont.lilita(15)).foregroundStyle(Color.sukaBrown)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.sukaMuted)
            }
            .padding(14)
            .kartuElegan(sudut: 18, elevasi: 1, latar: .white)
        }
        .buttonStyle(.mentul(0.98))
    }
}
