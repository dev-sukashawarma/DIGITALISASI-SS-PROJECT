import Foundation
import Observation

enum StatusLokasi: Equatable { case mencari, aktif, tanpaIzin, tidakTersedia }

/// Padanan `OutletPickerViewModel.kt`.
@MainActor
@Observable
final class OutletPickerViewModel {
    private(set) var memuat = true
    private(set) var galat: GatewayError?
    var kueri = "" { didSet { tampil = saringOutlet(semua, kueri: kueri) } }
    private(set) var semua: [OutletDto] = []
    private(set) var tampil: [OutletDto] = []
    /// nil = jarak tidak ditampilkan dan urutan jatuh ke alfabetis.
    private(set) var posisi: Koordinat?
    private(set) var statusLokasi: StatusLokasi = .mencari

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let lokasi: LokasiPelanggan?
    /// Dialog izin diminta otomatis SEKALI saat layar dibuka; setelah itu hanya
    /// lewat tombol, supaya pelanggan yang menolak tidak dikejar dialog terus.
    @ObservationIgnored private var sudahDiminta = false

    init(repository: Repository, lokasi: LokasiPelanggan? = nil) {
        self.repository = repository
        self.lokasi = lokasi
        if lokasi == nil { statusLokasi = .tanpaIzin }
    }

    func muat() async {
        memuat = true
        galat = nil
        switch await repository.outlets() {
        case .gagal(let g):
            memuat = false
            galat = g
        case .sukses(let daftar):
            semua = daftar
            urutUlang()
            memuat = false
        }
    }

    /// Dipanggil saat layar dibuka: minta izin sekali bila belum pernah ditanya.
    func mulaiLokasi() async {
        guard let lokasi else { return }
        if lokasi.bisaDitanya && !sudahDiminta {
            sudahDiminta = true
            statusLokasi = .tanpaIzin
            await lokasi.mintaIzin()
        }
        await perbaruiLokasi()
    }

    /// Setelah izin dijawab, dari tombol lokasi, dan saat kembali dari Pengaturan.
    func perbaruiLokasi() async {
        guard let lokasi else { return }
        guard lokasi.punyaIzin else {
            statusLokasi = .tanpaIzin
            return
        }
        statusLokasi = .mencari
        switch await lokasi.ambil() {
        case .ada(let k):
            posisi = k
            statusLokasi = .aktif
            urutUlang()
        case .tanpaIzin:
            statusLokasi = .tanpaIzin
        case .tidakTersedia:
            // Posisi lama (kalau ada) dibiarkan: urutan yang sudah benar tidak dirusak.
            statusLokasi = posisi != nil ? .aktif : .tidakTersedia
        }
    }

    /// Pelanggan kembali dari Pengaturan: izin mungkin baru saja diberikan di sana.
    func cekIzinUlang() async {
        if statusLokasi == .tanpaIzin, lokasi?.punyaIzin == true { await perbaruiLokasi() }
    }

    /// Tombol lokasi: belum pernah ditanya -> dialog; sudah ditolak -> Pengaturan
    /// (dikembalikan `true` agar layar membukanya); selain itu ambil ulang.
    func mintaLokasi() async -> Bool {
        guard let lokasi else { return false }
        if lokasi.punyaIzin { await perbaruiLokasi(); return false }
        if lokasi.bisaDitanya {
            sudahDiminta = true
            await lokasi.mintaIzin()
            await perbaruiLokasi()
            return false
        }
        return true
    }

    private func urutUlang() {
        semua = urutkanOutlet(semua, posisi: posisi)
        tampil = saringOutlet(semua, kueri: kueri)
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
