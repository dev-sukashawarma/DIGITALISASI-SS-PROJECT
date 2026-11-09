import SwiftUI

/// Padanan `ui/voucher/VoucherScreen.kt` — dibuka dari Beranda ("Voucher
/// untukmu") dan Profil ("Voucher Saya"). Menampilkan SEMUA voucher publik,
/// bukan hanya yang cocok dengan keranjang (itu tugas pemilih di checkout).
struct VoucherView: View {
    @State var vm: VoucherViewModel
    let onKembali: () -> Void
    let onSetelahPakai: () -> Void
    let onMasuk: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Voucher", subjudul: "Promo yang bisa kamu pakai", onKembali: onKembali)
            isi.frame(maxHeight: .infinity)
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.muatUlang() }
    }

    @ViewBuilder private var isi: some View {
        if vm.memuat {
            MemuatState()
        } else if case .sesiTidakSah? = vm.galat {
            // Daftar voucher bergantung pada akun (kuota per pelanggan).
            EmptyState(judul: "Masuk dulu", penjelasan: "Voucher terhubung ke akunmu. Masuk untuk melihatnya.",
                       tombol: ("Masuk", onMasuk))
        } else if let g = vm.galat {
            ErrorState(galat: g) { Task { await vm.muatUlang() } }
        } else if vm.vouchers.isEmpty {
            EmptyState(judul: "Belum ada voucher", penjelasan: "Voucher baru akan muncul di sini.")
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(vm.vouchers) { v in
                        KartuVoucher(voucher: v) {
                            vm.pakai(v)
                            onSetelahPakai()
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
            }
            .refreshable { await vm.muatUlang() }
        }
    }
}
