import Foundation
import Observation

/// Padanan `ui/voucher/VoucherViewModel.kt`.
@MainActor
@Observable
final class VoucherViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    private(set) var vouchers: [VoucherDto] = []

    @ObservationIgnored private let muat: () async -> GatewayResult<[VoucherDto]>
    @ObservationIgnored private let cart: CartStore

    init(muat: @escaping () async -> GatewayResult<[VoucherDto]>, cart: CartStore) {
        self.muat = muat
        self.cart = cart
    }

    func muatUlang() async {
        memuat = true
        galat = nil
        switch await muat() {
        case .sukses(let daftar):
            vouchers = daftar
        case .gagal(let g):
            galat = g
        }
        memuat = false
    }

    /// Memasang voucher ke keranjang — checkout yang memvalidasinya.
    func pakai(_ v: VoucherDto) {
        cart.pasangVoucher(PilihanVoucher(id: v.id, nama: v.nama))
    }
}
