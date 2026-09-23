import Foundation
import Observation

/// Padanan `InformasiAkunViewModel.kt`: ubah Nama & No WhatsApp. Email terkunci
/// (identitas akun Google untuk masuk).
@MainActor
@Observable
final class InformasiAkunViewModel {
    var nama = "" { didSet { if nama != oldValue { galatNama = nil; bersihkanPesan() } } }
    private(set) var email: String?
    var whatsApp = "" { didSet { if whatsApp != oldValue { galatWhatsApp = nil; bersihkanPesan() } } }
    /// Nilai terakhir yang tersimpan di server, untuk tahu ada perubahan atau tidak.
    private(set) var namaTersimpan = ""
    private(set) var whatsAppTersimpan = ""
    private(set) var galatNama: String?
    private(set) var galatWhatsApp: String?
    private(set) var menyimpan = false
    private(set) var pesanGalat: String?
    private(set) var tersimpan = false

    var adaPerubahan: Bool {
        ProfilForm.rapikanNama(nama) != namaTersimpan
            || whatsApp.trimmingCharacters(in: .whitespaces) != whatsAppTersimpan
    }

    @ObservationIgnored private let repository: Repository
    @ObservationIgnored private let sessionStore: SessionStore
    /// `didSet` juga terpanggil saat nilai diisi dari server; saat itu pesan
    /// "tersimpan" tak boleh ikut terhapus.
    @ObservationIgnored private var sedangMenerapkan = false

    init(repository: Repository, sessionStore: SessionStore) {
        self.repository = repository
        self.sessionStore = sessionStore
        let sesi = sessionStore.baca()
        let n = sesi?.nama?.trimmingCharacters(in: .whitespaces) ?? ""
        let wa = ProfilForm.untukIsian(sesi?.telepon)
        sedangMenerapkan = true
        nama = n; whatsApp = wa
        sedangMenerapkan = false
        email = sesi?.email
        namaTersimpan = n
        whatsAppTersimpan = wa
    }

    private func bersihkanPesan() {
        guard !sedangMenerapkan else { return }
        pesanGalat = nil
        tersimpan = false
    }

    /// Sesi lokal bisa basi (nomor diisi saat pesan, nama diubah di HP lain).
    /// Segarkan diam-diam; kalau gagal, isian dari sesi tetap dipakai.
    func segarkan() async {
        if case .sukses(let c) = await repository.profil() { terapkanDariServer(c, tandaiTersimpan: false) }
    }

    func simpan() async {
        guard !menyimpan, adaPerubahan else { return }

        let gNama = ProfilForm.galatNama(nama)
        let gWa = ProfilForm.galatWhatsApp(whatsApp)
        if gNama != nil || gWa != nil {
            galatNama = gNama
            galatWhatsApp = gWa
            return
        }

        let namaBaru = ProfilForm.rapikanNama(nama)
        let waBaru = whatsApp.trimmingCharacters(in: .whitespaces)
        // Kirim hanya yang berubah: field nil tidak disentuh gateway. Nomor
        // dikirim apa adanya — gateway yang menormalkan ke 628xxxx.
        let kirimNama = namaBaru != namaTersimpan ? namaBaru : nil
        let kirimWa = waBaru != whatsAppTersimpan ? waBaru : nil

        menyimpan = true
        pesanGalat = nil
        tersimpan = false
        switch await repository.simpanProfil(nama: kirimNama, telepon: kirimWa) {
        case .sukses(let c):
            terapkanDariServer(c, tandaiTersimpan: true)
        case .gagal(let g):
            menyimpan = false
            pesanGalat = SukaShawarma.pesanGalat(g)
        }
    }

    private func terapkanDariServer(_ c: CustomerDto, tandaiTersimpan: Bool) {
        guard let sesi = sessionStore.baca() else { return }
        sessionStore.simpan(token: sesi.token, expiresAt: sesi.expiresAt, nama: c.name,
                            email: c.email ?? sesi.email, telepon: c.phone)
        let n = c.name?.trimmingCharacters(in: .whitespaces) ?? ""
        let wa = ProfilForm.untukIsian(c.phone)
        // Penyegaran awal tak boleh menimpa yang sedang diketik pelanggan.
        let sedangMengetik = !tandaiTersimpan && adaPerubahan
        sedangMenerapkan = true
        if !sedangMengetik { nama = n; whatsApp = wa }
        sedangMenerapkan = false
        email = c.email ?? email
        namaTersimpan = n
        whatsAppTersimpan = wa
        menyimpan = false
        tersimpan = tandaiTersimpan
    }
}
