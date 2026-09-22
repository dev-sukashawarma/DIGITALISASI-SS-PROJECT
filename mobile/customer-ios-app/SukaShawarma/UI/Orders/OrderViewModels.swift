import Foundation
import Observation

/// Padanan `HistoryViewModel.kt`.
@MainActor
@Observable
final class HistoryViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    private(set) var pesanan: [OrderDetailDto] = []
    var filter: FilterRiwayat = .semua

    var tampil: [OrderDetailDto] { filter.saring(pesanan) }

    @ObservationIgnored private let repository: Repository

    init(repository: Repository) { self.repository = repository }

    func muat() async {
        memuat = pesanan.isEmpty
        galat = nil
        switch await repository.riwayat() {
        case .sukses(let d): pesanan = d; galat = nil
        case .gagal(let g): galat = g
        }
        memuat = false
    }
}

/// Padanan `OrderStatusViewModel.kt`: menyegarkan status tiap 10 detik selama
/// pesanan berjalan, berhenti sendiri begitu selesai atau dibatalkan.
@MainActor
@Observable
final class OrderStatusViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    private(set) var pesanan: OrderDetailDto?

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let orderId: String
    @ObservationIgnored private let jeda: Duration

    init(repository: Repository, orderId: String, jeda: Duration = .seconds(10)) {
        self.repository = repository
        self.orderId = orderId
        self.jeda = jeda
    }

    /// Dijalankan dari `.task` layar: berhenti otomatis saat layar ditutup.
    func pantau() async {
        while !Task.isCancelled {
            await ambil()
            let t = tampilanStatus(pesanan?.statusDapur)
            if t.selesai || t.dibatalkan { return }
            try? await Task.sleep(for: jeda)
        }
    }

    func ambil() async {
        switch await repository.statusPesanan(orderId: orderId) {
        case .sukses(let d):
            pesanan = d
            galat = nil
        case .gagal(let g):
            // Data lama DIPERTAHANKAN: kehilangan sinyal sesaat tak boleh
            // menghapus nomor pesanan dari layar pelanggan di depan kasir.
            galat = g
        }
        memuat = false
    }
}
