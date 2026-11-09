import Foundation

/// Padanan `ui/checkout/VoucherCheckout.kt`.

/// Alasan tombol Bayar dikunci karena voucher; nil = tidak dikunci.
///
/// Voucher yang tidak berlaku lagi SENGAJA tidak dilepas diam-diam: pelanggan
/// memilihnya dengan sengaja, jadi ia yang memutuskan melepas atau memenuhi syaratnya.
func alasanKunciVoucher(_ pilihan: PilihanVoucher?, _ blok: VoucherCheckoutDto?) -> String? {
    guard pilihan != nil else { return nil }
    guard let blok else { return "Voucher belum bisa dicek. Lepas voucher untuk melanjutkan." }
    if blok.status == "berlaku" { return nil }
    return blok.alasan ?? "Voucher tidak berlaku untuk pesanan ini."
}

func labelPotonganVoucher(_ blok: VoucherCheckoutDto?) -> String {
    blok?.status == "berlaku" ? "Potongan voucher" : "Potongan Promo"
}

/// Boleh menampilkan alasan kunci voucher. Bila Bayar SUDAH terkunci oleh
/// sebab lain (keranjang berubah, outlet tutup, menu habis), alasan voucher
/// disembunyikan: menyuruh "lepas voucher untuk melanjutkan" menyesatkan
/// karena melepasnya tidak akan membuka Bayar. `bolehLanjut` TIDAK berubah.
func tampilkanAlasanKunciVoucher(alasan: String?, masalah: [CartProblemDto]) -> Bool {
    alasan == nil && masalah.isEmpty
}
