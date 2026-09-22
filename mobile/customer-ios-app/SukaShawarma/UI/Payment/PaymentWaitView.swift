import SwiftUI

/// Padanan `PaymentWaitScreen.kt` — menunggu pembayaran QRIS.
struct PaymentWaitView: View {
    @State var vm: PaymentViewModel
    let onSelesai: (_ orderId: String, _ nomor: Int?) -> Void
    let onKembaliKeRingkasan: () -> Void
    let onLihatRiwayat: () -> Void

    @State private var halamanBayar: AlamatWeb?
    @State private var dibukaPada = Date()

    var body: some View {
        VStack(spacing: 0) {
            kepala
            ScrollView {
                VStack(spacing: 16) { isi }.padding(16)
            }
            if tampilMenunggu {
                BilahBawah {
                    VStack(spacing: 4) {
                        Button { Task { await vm.cekSekarang() } } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "arrow.clockwise").font(.system(size: 15, weight: .bold))
                                Text("Cek Status Pembayaran").font(SukaFont.jakarta(15, weight: .bold))
                            }
                            .foregroundStyle(Color.sukaBrown)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Color.sukaOrange, in: Capsule())
                        }
                        .buttonStyle(.mentul())
                        .accessibilityIdentifier("tombol-cek-status")
                        // Android menyebutnya "Batalkan Pembayaran", padahal hanya kembali:
                        // tagihan & QR tetap berlaku. Label disesuaikan dengan perilakunya.
                        Button("Kembali ke Ringkasan", action: onKembaliKeRingkasan)
                            .font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaMuted)
                            .frame(minHeight: 40)
                    }
                }
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .latarBilahStatus()
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.mulai() }
        .onChange(of: vm.dibayar) { _, dibayar in
            if dibayar, let id = vm.orderId { onSelesai(id, vm.nomorPesanan) }
        }
        .onChange(of: vm.paymentUrl) { _, url in
            // Halaman web HANYA dibuka otomatis bila tidak ada QR.
            if vm.qrString == nil, let url, let alamat = URL(string: url) {
                halamanBayar = AlamatWeb(url: alamat)
                vm.urlOtomatisDibuka()
            }
        }
        .sheet(item: $halamanBayar) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    private var tampilMenunggu: Bool { vm.memuat || vm.menungguKonfirmasi || vm.qrString != nil }

    private var kepala: some View {
        HStack {
            Button(action: onKembaliKeRingkasan) {
                Image(systemName: "chevron.left").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .frame(width: 40, height: 40).background(Color.white, in: Circle())
            }
            .buttonStyle(.mentul())
            .accessibilityLabel("Kembali")
            Spacer()
            VStack(spacing: 0) {
                Text("Pembayaran QRIS").font(SukaFont.jakarta(17, weight: .bold)).foregroundStyle(Color.sukaBrown)
                Text("Order-Ahead & Ambil di Outlet").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
            }
            Spacer()
            Color.clear.frame(width: 40, height: 40)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Color.sukaCream.shadow(.drop(color: .black.opacity(0.06), radius: 1, y: 1)))
    }

    @ViewBuilder private var isi: some View {
        if tampilMenunggu {
            kartuMenunggu
            kartuVerifikasi
            kartuPanduan
        } else if vm.gagalBayar {
            KartuStatus(judul: "Pembayaran Tidak Berhasil",
                        keterangan: "Pembayaran ditolak atau dibatalkan. Keranjangmu masih tersimpan.",
                        labelUtama: "Coba Bayar Lagi", aksiUtama: { Task { await vm.bayar() } },
                        labelKedua: "Kembali ke Ringkasan", aksiKedua: onKembaliKeRingkasan)
        } else if vm.kadaluarsa {
            KartuStatus(judul: "Batas Waktu Habis",
                        keterangan: "Batas waktu pesanan ini sudah lewat. Tekan di bawah untuk membuat pembayaran baru.",
                        labelUtama: "Buat Pembayaran Baru", aksiUtama: { Task { await vm.bayar() } },
                        labelKedua: "Kembali ke Ringkasan", aksiKedua: onKembaliKeRingkasan)
        } else if vm.waktuHabis {
            KartuStatus(judul: "Belum Ada Kabar dari Bank",
                        keterangan: "Kalau kamu sudah membayar, pesananmu sedang diproses di kasir — cek riwayat beberapa saat lagi. Kalau belum, coba bayar lagi.",
                        labelUtama: "Cek Riwayat Pesanan", aksiUtama: onLihatRiwayat,
                        labelKedua: "Coba Bayar Lagi", aksiKedua: { Task { await vm.bayar() } })
        } else if let pesan = vm.pesanGalat {
            KartuStatus(judul: "Terjadi Kendala", keterangan: pesan,
                        labelUtama: "Coba Lagi", aksiUtama: { Task { await vm.bayar() } },
                        labelKedua: "Kembali ke Ringkasan", aksiKedua: onKembaliKeRingkasan)
        } else {
            TombolUtama(label: "Mulai Pembayaran") { Task { await vm.bayar() } }
        }
    }

    /// Batas bayar: dari `expires_at` gateway bila terbaca, kalau tidak 15 menit
    /// sejak layar dibuka (Android selalu memakai yang kedua).
    private var batasBayar: Date {
        if let e = vm.expiresAt, let ms = uraiWaktuIso(e) { return Date(timeIntervalSince1970: Double(ms) / 1000) }
        return dibukaPada.addingTimeInterval(15 * 60)
    }

    private var kartuMenunggu: some View {
        VStack(spacing: 12) {
            HStack(spacing: 6) {
                Circle().fill(Color.sukaOrange).frame(width: 8, height: 8)
                    .phaseAnimator([0.4, 1.0]) { v, a in v.opacity(a) } animation: { _ in .easeInOut(duration: 1) }
                Text("Menunggu Pembayaran").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaBrown)
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(Color.sukaTint, in: Capsule())

            Text("Selesaikan pembayaran dalam waktu").font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted)
            TimelineView(.periodic(from: .now, by: 1)) { konteks in
                let sisa = max(0, Int(batasBayar.timeIntervalSince(konteks.date)))
                HStack(spacing: 6) {
                    Image(systemName: "clock").font(.system(size: 16, weight: .bold))
                    Text(String(format: "%02d:%02d", sisa / 60, sisa % 60)).font(SukaFont.lilita(30)).monospacedDigit()
                }
                .foregroundStyle(Color.sukaBrown)
                .accessibilityLabel("Sisa waktu \(sisa / 60) menit \(sisa % 60) detik")
            }
            Text("Kode QR otomatis kedaluwarsa setelah batas waktu habis.")
                .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)

            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text("QRIS").font(SukaFont.lilita(18)).foregroundStyle(Color.sukaInk)
                    Text("STANDAR PEMBAYARAN NASIONAL").font(SukaFont.jakarta(8, weight: .bold)).foregroundStyle(Color.sukaMuted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text("MERCHANT RESMI").font(SukaFont.jakarta(9, weight: .bold)).foregroundStyle(Color.sukaMuted)
                    Text("SUKA SHAWARMA INDONESIA").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaInk)
                }
            }
            .padding(.top, 4)

            if let qr = vm.qrString {
                KartuQris(qrString: qr)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xEAD7C5), lineWidth: 2))
            } else {
                ProgressView().tint(Color.sukaOrange).frame(height: 200)
            }

            if vm.totalTagihan > 0 {
                VStack(spacing: 2) {
                    Text("Total Tagihan Pembayaran").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    Text(rupiah(vm.totalTagihan)).font(SukaFont.lilita(26)).foregroundStyle(Color.sukaBrown)
                }
            }

            if vm.qrString == nil, let url = vm.urlBayarTersimpan ?? vm.paymentUrl, let alamat = URL(string: url) {
                Button { halamanBayar = AlamatWeb(url: alamat) } label: {
                    Text("Buka Ulang Halaman Pembayaran").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sukaOrange, lineWidth: 1))
                }
            }
        }
        .padding(18)
        .kartuSuka(sudut: 22, elevasi: 3)
    }

    private var kartuVerifikasi: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.sukaGreen)
            VStack(alignment: .leading, spacing: 2) {
                Text("Verifikasi Pembayaran Otomatis").font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
                Text("Setelah membayar, status pesanan diperbarui otomatis. Kamu tidak perlu mengirim bukti transfer kasir.")
                    .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: 0xE8F8F0), in: RoundedRectangle(cornerRadius: 16))
    }

    private var kartuPanduan: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("MENERIMA SEMUA E-WALLET & MOBILE BANKING").font(SukaFont.jakarta(10, weight: .bold)).tracking(0.5)
                .foregroundStyle(Color.sukaMuted)
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(["BCA", "Mandiri", "GoPay", "OVO", "ShopeePay", "DANA"], id: \.self) {
                        Text($0).font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaInk)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(Color.sukaTint, in: Capsule())
                    }
                }
            }
            .scrollIndicators(.hidden)
            Divider().overlay(Color.sukaBorder)
            HStack {
                Text("Cara Membayar dengan QRIS").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                Spacer()
                Text("4 Langkah").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .padding(.horizontal, 8).padding(.vertical, 3).background(Color.sukaTint, in: Capsule())
            }
            ForEach(Array([
                "Buka aplikasi mobile banking (BCA, Mandiri, BRI, Livin) atau e-Wallet (GoPay, OVO, ShopeePay, DANA).",
                "Pilih menu \"Scan\" atau \"Bayar\" lalu arahkan kamera ke kode QR di atas.",
                "Periksa nama merchant SUKA SHAWARMA dan pastikan nominal sesuai total pesanan.",
                "Masukkan PIN keamanan Anda dan konfirmasi pembayaran hingga selesai.",
            ].enumerated()), id: \.offset) { i, langkah in
                HStack(alignment: .top, spacing: 10) {
                    Text("\(i + 1)").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaInk)
                        .frame(width: 22, height: 22).background(Color.sukaOrange, in: Circle())
                    Text(langkah).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaBody)
                }
            }
        }
        .padding(16)
        .kartuSuka(sudut: 20, elevasi: 2)
    }
}

/// Kartu keadaan akhir (gagal / kedaluwarsa / waktu habis / galat).
private struct KartuStatus: View {
    let judul: String
    let keterangan: String
    let labelUtama: String
    let aksiUtama: () -> Void
    let labelKedua: String
    let aksiKedua: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text(judul).font(SukaFont.lilita(22)).foregroundStyle(Color.sukaBrown).multilineTextAlignment(.center)
            Text(keterangan).font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted).multilineTextAlignment(.center)
            Button(action: aksiUtama) {
                Text(labelUtama).font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .frame(maxWidth: .infinity, minHeight: 50).background(Color.sukaOrange, in: Capsule())
            }
            .buttonStyle(.mentul())
            Button(labelKedua, action: aksiKedua)
                .font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaMuted).frame(minHeight: 40)
        }
        .padding(24)
        .kartuSuka(sudut: 22, elevasi: 3)
    }
}
