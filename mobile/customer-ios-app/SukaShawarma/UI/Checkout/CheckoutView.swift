import SwiftUI

/// Padanan `ui/checkout/CheckoutScreen.kt`: ringkasan + validasi gateway.
/// Tombol bayar hanya aktif bila gateway meloloskan pesanan (`bolehLanjut`).
struct CheckoutView: View {
    @State var vm: CheckoutViewModel
    let onKembali: () -> Void
    let onBayar: () -> Void
    var namaOutlet: String? = nil
    /// Outlet tak bisa menerima pesanan sekarang. Default true = perilaku lama.
    var outletBolehPesan = true
    var labelOutletTutup: String? = nil
    /// Dipanggil saat gateway menjawab 401 — sesi habis, pelanggan harus masuk lagi.
    let onSesiHabis: () -> Void

    @State private var tampilPemilihVoucher = false
    @Environment(\.scenePhase) private var fase

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Ringkasan Pesanan", subjudul: "Detail tagihan & pembayaran", onKembali: onKembali)
            isi.frame(maxHeight: .infinity)
            if !vm.keranjangKosong && !vm.memuat && vm.galat == nil {
                BilahBawah {
                    VStack(spacing: 8) {
                        if !outletBolehPesan { KeteranganOutletTutup(teks: labelOutletTutup) }
                        HStack {
                            VStack(alignment: .leading, spacing: 0) {
                                Text("Total Tagihan").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                                Text(vm.total.map(rupiah) ?? "-").font(SukaFont.lilita(19)).foregroundStyle(Color.sukaBrown)
                            }
                            Spacer()
                            TombolAksi(label: !outletBolehPesan ? "Outlet Tutup" : vm.bolehLanjut ? "Bayar Sekarang" : "Periksa Pesanan",
                                       ikonKiri: "lock.fill", aktif: vm.bolehLanjut && outletBolehPesan, aksi: onBayar)
                                .accessibilityIdentifier("tombol-bayar")
                        }
                    }
                }
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.validasi() }
        // Pelanggan bisa pergi sebentar (cek saldo di aplikasi bank) lalu kembali
        // dengan voucher yang sudah habis kuota/kedaluwarsa di server — validasi
        // ulang supaya Bayar terkunci lagi bila memang tak berlaku.
        .onChange(of: fase) { _, baru in
            if baru == .active { Task { await vm.validasi() } }
        }
        .sheet(isPresented: $tampilPemilihVoucher) {
            PemilihVoucherSheet(muatDaftar: vm.daftarVoucher) { pilihan in
                tampilPemilihVoucher = false
                Task { await vm.pasangVoucher(pilihan) }
            }
        }
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
                    KartuPickup(judul: "PENGAMBILAN DI OUTLET", namaOutlet: namaOutlet, keterangan: "Pesanan disiapkan saat pembayaran terkonfirmasi")

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
                            Text("\(b.jumlah)x \(b.nama)").font(SukaFont.jakarta(14, weight: .semibold)).foregroundStyle(Color.sukaInk)
                            if let c = b.catatan, !c.isEmpty {
                                Text("\"\(c)\"").font(SukaFont.jakarta(11)).italic().foregroundStyle(Color.sukaMuted)
                            }
                        }
                        Spacer()
                        Text(rupiah(b.hargaSatuan * Int64(b.jumlah))).font(SukaFont.lilita(15)).foregroundStyle(Color.sukaBrown)
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
            // Item gratis dari voucher — tanpa ubah jumlah/hapus: pelanggan
            // tidak "memesan" item ini, voucher yang memberikannya.
            ForEach(Array((vm.blokVoucher?.itemGratis ?? []).enumerated()), id: \.offset) { _, g in
                HStack {
                    Text("\(g.quantity)x \(g.name)").font(SukaFont.jakarta(14, weight: .semibold)).foregroundStyle(Color.sukaInk)
                    Spacer()
                    Text("Gratis").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaGreen)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.sukaGreen.opacity(0.12), in: Capsule())
                }
                .padding(.vertical, 3)
            }
        }
        .padding(16)
        .kartuElegan(sudut: 18, elevasi: 1, latar: .white)
    }

    /// Hanya QRIS yang didukung gateway saat ini — ditampilkan sebagai pilihan tunggal terpilih.
    private var kartuMetode: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Metode Pembayaran").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
            HStack {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.sukaOrange.opacity(0.15))
                            .frame(width: 36, height: 36)
                        Image(systemName: "qrcode").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.sukaOrange)
                    }
                    VStack(alignment: .leading, spacing: 1) {
                        Text("QRIS (Semua E-Wallet & Bank)").font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
                        Text("Verifikasi instan otomatis").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                }
                Spacer()
                Image(systemName: "checkmark.circle.fill").font(.system(size: 20)).foregroundStyle(Color.sukaOrange)
            }
            .padding(12)
            .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sukaOrange.opacity(0.6), lineWidth: 1.5))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isSelected)
        }
        .padding(16)
        .kartuElegan(sudut: 18, elevasi: 1, latar: .white)
    }

    private var kartuTotal: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ringkasan Pembayaran").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
            barisVoucher
            if let s = vm.subtotal { BarisRingkasan(label: "Subtotal", nilai: rupiah(s)) }
            if let p = vm.potongan, p > 0 {
                BarisRingkasan(label: labelPotonganVoucher(vm.blokVoucher), nilai: "- \(rupiah(p))",
                               warnaLabel: .sukaGreen, warnaNilai: .sukaGreen)
            }
            BarisRingkasan(label: "Biaya Layanan & Pengambilan", nilai: "GRATIS", warnaNilai: .sukaGreen)
            Divider().overlay(Color.black.opacity(0.06))
            if let t = vm.total { BarisRingkasan(label: "Total yang Dibayar", nilai: rupiah(t), warnaNilai: .sukaBrown, tebal: true) }
        }
        .padding(16)
        .kartuElegan(sudut: 18, elevasi: 1, latar: .white)
        .padding(.bottom, 16)
    }
}

extension CheckoutView {
    /// Baris "Pakai voucher": belum ada voucher (ketuk untuk memilih), voucher
    /// terpasang (nama + Lepas), atau terpasang tapi terkunci (+ alasan merah).
    /// Voucher yang terkunci TIDAK dilepas otomatis — pelanggan yang memutuskan.
    fileprivate var barisVoucher: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 8) {
                Image(systemName: "ticket.fill").font(.system(size: 14)).foregroundStyle(Color.sukaOrange)
                // Nama dari gateway menang: kode manual disimpan mentah sampai gateway membalas nama aslinya.
                Text(vm.blokVoucher?.nama ?? vm.voucher?.nama ?? "Pakai voucher hemat")
                    .font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                Spacer()
                if vm.voucher == nil {
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.sukaMuted)
                } else {
                    Button("Lepas") { Task { await vm.lepasVoucher() } }
                        .font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color.sukaTint, in: Capsule())
                        .frame(minWidth: 44, minHeight: 36)
                        .accessibilityIdentifier("tombol-lepas-voucher")
                }
            }
            .frame(minHeight: 36)
            .contentShape(Rectangle())
            .onTapGesture { if vm.voucher == nil { tampilPemilihVoucher = true } }
            .accessibilityElement(children: .contain)
            .accessibilityAddTraits(vm.voucher == nil ? .isButton : [])
            .accessibilityIdentifier("baris-voucher")

            if let alasan = vm.alasanKunciVoucherTampil {
                Text(alasan).font(SukaFont.jakarta(12)).foregroundStyle(Color(hex: 0xDC2626))
                    .padding(.leading, 22)
                    .accessibilityIdentifier("alasan-kunci-voucher")
            }
        }
        .padding(.bottom, 2)
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
