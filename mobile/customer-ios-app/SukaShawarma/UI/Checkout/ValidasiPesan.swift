import Foundation

/// Padanan `ui/checkout/ValidasiPesan.kt`. Kode mesin (`habis`,
/// `harga_berubah`, `tidak_ada`) TIDAK PERNAH sampai ke layar, dan jenis yang
/// tak dikenal tetap menghasilkan kalimat — gateway boleh menambah jenis baru.
func pesanUntukMasalah(_ m: CartProblemDto) -> String {
    switch m.jenis {
    case "habis": "\(m.name) sedang habis."
    case "harga_berubah":
        if let harga = m.hargaBaru { "Harga \(m.name) berubah jadi \(rupiah(harga))." } else { "Harga \(m.name) berubah." }
    case "tidak_ada": "\(m.name) sudah tidak ada di menu outlet ini."
    default: "\(m.name) tidak bisa dipesan saat ini."
    }
}

/// Harga berubah bisa DITERIMA; item habis/hilang hanya bisa dibuang. Tidak
/// ada pilihan membuang seluruh keranjang — item lain dipilih dengan sengaja.
func labelTindakan(_ m: CartProblemDto) -> String {
    m.jenis == "harga_berubah" ? "Pakai harga baru" : "Hapus dari keranjang"
}

/// `alasan` menjelaskan kenapa SELURUH pesanan ditolak (bukan satu item).
func pesanUntukAlasan(_ alasan: String?, pesanDariGateway: String?) -> String {
    switch alasan {
    case "outlet_tutup": "Outlet sedang tutup, jadi pesanan belum bisa diproses."
    case "outlet_tidak_melayani": "Outlet ini belum melayani pesanan lewat aplikasi."
    case "keranjang_berubah": "Ada yang berubah di menu outlet sejak kamu memilih."
    // Kalimat gateway lebih spesifik daripada tebakan apa pun di sini.
    default: pesanDariGateway ?? "Pesanan belum bisa diproses."
    }
}

extension CartLine {
    /// Padanan `CartLine.kePayloadList()`: item utama + SETIAP topping sebagai
    /// baris sendiri, jumlahnya ikut item utama, catatannya "Topping <nama>".
    /// Bentuk ini yang dikenali gateway & dapur — jangan digabung jadi satu baris.
    func kePayloadList() -> [CartItemPayload] {
        [CartItemPayload(menuItemId: menuItemId, name: nama, unitPrice: Double(hargaSatuan),
                         quantity: jumlah, note: catatan)]
        + toppings.map {
            CartItemPayload(menuItemId: $0.menuItemId, name: $0.nama, unitPrice: Double($0.hargaSatuan),
                            quantity: jumlah, note: "Topping \(nama)")
        }
    }
}
