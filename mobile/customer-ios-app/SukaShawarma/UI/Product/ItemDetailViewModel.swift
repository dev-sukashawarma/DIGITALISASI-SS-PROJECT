import Foundation
import Observation

/// Padanan `ItemDetailViewModel.kt`.
@MainActor
@Observable
final class ItemDetailViewModel {
    private(set) var jumlah = 1
    /// Dipotong SAAT DIKETIK: pelanggan melihat batasnya sendiri.
    var catatan = "" {
        didSet { if catatan.count > panjangMaksCatatan { catatan = String(catatan.prefix(panjangMaksCatatan)) } }
    }
    private(set) var toppingTerpilih: Set<String> = []

    func ubahJumlah(_ delta: Int) {
        jumlah = min(max(jumlah + delta, 1), jumlahMaksPerItem)
    }

    func toggleTopping(_ id: String) {
        if toppingTerpilih.contains(id) { toppingTerpilih.remove(id) } else { toppingTerpilih.insert(id) }
    }
}
