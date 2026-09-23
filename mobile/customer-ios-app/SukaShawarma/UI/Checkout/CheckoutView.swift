import SwiftUI

/// Padanan `ui/checkout/CheckoutScreen.kt`: ringkasan + validasi gateway.
/// Tombol bayar hanya aktif bila gateway meloloskan pesanan (`bolehLanjut`).
struct CheckoutView: View {
    @State var vm: CheckoutViewModel
    let onKembali: () -> Void
    let onBayar: () -> Void
    /// Dipanggil saat gateway menjawab 401 — sesi habis, pelanggan harus masuk lagi.
    let onSesiHabis: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Ringkasan Pesanan", subjudul: "Detail tagihan & pembayaran", onKembali: onKembali)
            isi.frame(maxHeight: .infinity)
            if !vm.keranjangKosong && !vm.memuat && vm.galat == nil {
                BilahBawah {
                    HStack {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Total Tagihan").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                            Text(vm.total.map(rupiah) ?? "-").font(SukaFont.lilita(19)).foregroundStyle(Color.sukaBrown)
                        }
                        Spacer()
                        TombolAksi(label: vm.bolehLanjut ? "Bayar Sekarang" : "Periksa Pesanan",
                                   ikonKiri: "lock.fill", aktif: vm.bolehLanjut, aksi: onBayar)
                            .accessibilityIdentifier("tombol-bayar")
                    }
                }
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.validasi() }
    }

    @ViewBuilder private var isi: some View {
        if vm.keranjangKosong {
            EmptyState(judul: "Keranjang masih kosong", penjelasan: "Pilih menu dari katalog untuk mulai memesan.")
        } else if vm.memuat {
            MemuatState()
        } else if case .sesiTidakSah? = vm.galat {
            EmptyState(judul: "Sesi berakhir", penjelasan: pesanGalat(.sesiTidakSah),
                       tombol: ("Masuk lagi", onSesiHabis))
        } else if let galat = vm.galat {
            ErrorState(galat: galat) { Task { await vm.validasi() } }
        } else {
            ScrollView {
                LazyVStack(spacing: 14) {
                    KartuPickup(judul: "PENGAMBILAN DI OUTLET", keterangan: "Pesanan disiapkan saat pembayaran terkonfirmasi")

                    if let pesan = vm.pesanPenolakan {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Color(hex: 0xDC2626))
                            Text(pesan).font(SukaFont.jakarta(12)).foregroundStyle(Color(hex: 0x991B1B))
                            Spacer(minLength: 0)
                        }
                        .padding(12)
                        .background(Color(hex: 0xFEE2E2), in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xFCA5A5), lineWidth: 1))
                    }

                    ForEach(vm.masalah, id: \.menuItemId) { m in
                        KartuMasalah(masalah: m) { Task { await vm.perbaiki(m) } }
                    }
                    if vm.masalah.count > 1 {
                        Button { Task { await vm.perbaikiSemua() } } label: {
                            Text("Perbaiki semuanya").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaBrown)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sukaBorder, lineWidth: 1))
                        }
                    }

                    kartuRincian
                    kartuMetode
                    kartuTotal
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
            }
        }
    }

    private var kartuRincian: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Rincian Menu").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
            ForEach(Array(vm.baris.enumerated()), id: \.offset) { _, b in
                VStack(spacing: 3) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("\(b.jumlah)x \(b.nama)").font(SukaFont.jakarta(14, weight: .medium)).foregroundStyle(Color.sukaInk)
                            if let c = b.catatan, !c.isEmpty {
                                Text("\"\(c)\"").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                            }
                        }
                        Spacer()
                        Text(rupiah(b.hargaSatuan * Int64(b.jumlah))).font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    }
                    ForEach(b.toppings, id: \.menuItemId) { t in
                        HStack(spacing: 5) {
                            Text("↳").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaOrangeTeks)
                            Text("+ \(t.nama)").font(SukaFont.jakarta(12, weight: .medium)).foregroundStyle(Color.sukaMuted)
                            Spacer()
                            Text(rupiah(t.hargaSatuan * Int64(b.jumlah))).font(SukaFont.jakarta(12, weight: .medium))
                                .foregroundStyle(Color.sukaBrown.opacity(0.85))
                        }
                        .padding(.leading, 16)
                    }
                }
                .padding(.vertical, 3)
            }
        }
        .padding(16)
        .kartuSuka(sudut: 18, elevasi: 2, tepi: .sukaBorder.opacity(0.8))
    }

    /// Hanya QRIS yang didukung gateway saat ini — ditampilkan sebagai pilihan tunggal terpilih.
    private var kartuMetode: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Metode Pembayaran").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
            HStack {
                HStack(spacing: 10) {
                    Image(systemName: "qrcode").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.sukaInk)
                        .frame(width: 34, height: 34).background(Color.sukaOrange, in: Circle())
                    VStack(alignment: .leading, spacing: 0) {
                        Text("QRIS (Semua E-Wallet & Bank)").font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
                        Text("Verifikasi instan otomatis").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                }
                Spacer()
                Image(systemName: "checkmark.circle.fill").font(.system(size: 18)).foregroundStyle(Color.sukaOrange)
            }
            .padding(12)
            .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sukaOrange, lineWidth: 1.5))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isSelected)
        }
        .padding(16)
        .kartuSuka(sudut: 18, elevasi: 2, tepi: .sukaBorder.opacity(0.8))
    }

    private var kartuTotal: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ringkasan Pembayaran").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
            if let s = vm.subtotal { BarisRingkasan(label: "Subtotal", nilai: rupiah(s)) }
            if let p = vm.potongan, p > 0 {
                BarisRingkasan(label: "Potongan Promo", nilai: "- \(rupiah(p))", warnaLabel: .sukaGreen, warnaNilai: .sukaGreen)
            }
            BarisRingkasan(label: "Biaya Layanan & Pengambilan", nilai: "GRATIS", warnaNilai: .sukaGreen)
            Divider().overlay(Color.sukaBorder.opacity(0.5))
            if let t = vm.total { BarisRingkasan(label: "Total yang Dibayar", nilai: rupiah(t), warnaNilai: .sukaBrown, tebal: true) }
        }
        .padding(16)
        .kartuSuka(sudut: 18, elevasi: 2, tepi: .sukaBorder.opacity(0.8))
        .padding(.bottom, 16)
    }
}

private struct KartuMasalah: View {
    let masalah: CartProblemDto
    let onPerbaiki: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text(pesanUntukMasalah(masalah)).font(SukaFont.jakarta(12)).foregroundStyle(Color(hex: 0x92400E))
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onPerbaiki) {
                Text(labelTindakan(masalah)).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.sukaBrown.opacity(0.5), lineWidth: 1))
            }
            .buttonStyle(.mentul())
        }
        .padding(12)
        .background(Color(hex: 0xFEF3C7), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xFCD34D), lineWidth: 1))
    }
}
