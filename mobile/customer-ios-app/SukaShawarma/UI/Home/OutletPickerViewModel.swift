import Foundation
import Observation

/// Padanan `OutletPickerViewModel.kt`.
@MainActor
@Observable
final class OutletPickerViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    var kueri = "" { didSet { tampil = saringOutlet(semua, kueri: kueri) } }
    private(set) var semua: [OutletDto] = []
    private(set) var tampil: [OutletDto] = []

    @ObservationIgnored private let repository: Repository

    init(repository: Repository) {
        self.repository = repository
    }

    func muat() async {
        memuat = true
        galat = nil
        switch await repository.outlets() {
        case .gagal(let g):
            memuat = false
            galat = g
        case .sukses(let daftar):
            semua = urutkanOutlet(daftar)
            tampil = saringOutlet(semua, kueri: kueri)
            memuat = false
        }
    }
}

/// Menyaring outlet berdasarkan nama atau alamat.
func saringOutlet(_ outlets: [OutletDto], kueri: String) -> [OutletDto] {
    let bersih = kueri.trimmingCharacters(in: .whitespaces).lowercased()
    guard !bersih.isEmpty else { return outlets }
    return outlets.filter {
        $0.name.lowercased().contains(bersih) || ($0.address?.lowercased().contains(bersih) ?? false)
    }
}

/// Yang buka di atas, lalu alfabetis. Jarak TIDAK dihitung: gateway tak
/// mengirim lokasi pelanggan dan aplikasi belum meminta izin lokasi.
func urutkanOutlet(_ outlets: [OutletDto]) -> [OutletDto] {
    outlets.sorted {
        if $0.isActive != $1.isActive { return $0.isActive }
        return $0.name.lowercased() < $1.name.lowercased()
    }
}
