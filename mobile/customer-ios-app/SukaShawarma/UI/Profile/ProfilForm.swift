import Foundation

/// Padanan `ui/profile/ProfilForm.kt`. Cermin PERSIS dari
/// apps/retail-gateway/src/lib/profil.ts — gateway tetap penentu; validasi di
/// sini hanya supaya pesan salah muncul tanpa menunggu jaringan.
enum ProfilForm {
    static let namaMin = 2
    static let namaMaks = 60

    static func rapikanNama(_ masukan: String) -> String {
        masukan.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }

    /// Pesan salah untuk nama, atau nil bila sah.
    static func galatNama(_ masukan: String) -> String? {
        let n = rapikanNama(masukan).count
        if n < namaMin { return "Nama minimal \(namaMin) huruf." }
        if n > namaMaks { return "Nama maksimal \(namaMaks) huruf." }
        return nil
    }

    /// Nomor HP Indonesia → bentuk kanonik 628xxxx, atau nil bila tidak wajar.
    static func normalisasiWhatsApp(_ masukan: String) -> String? {
        let bersih = masukan.replacingOccurrences(of: #"[\s\-().]"#, with: "", options: .regularExpression)
        let angka: String
        if bersih.hasPrefix("+62") { angka = "62" + bersih.dropFirst(3) }
        else if bersih.hasPrefix("62") { angka = bersih }
        else if bersih.hasPrefix("0") { angka = "62" + bersih.dropFirst() }
        else { return nil }
        return angka.range(of: #"^628\d{7,12}$"#, options: .regularExpression) != nil ? angka : nil
    }

    /// Kosong itu sah (tanpa nomor); selain itu harus nomor HP Indonesia.
    static func galatWhatsApp(_ masukan: String) -> String? {
        if masukan.trimmingCharacters(in: .whitespaces).isEmpty { return nil }
        return normalisasiWhatsApp(masukan) == nil
            ? "Nomor WhatsApp harus nomor HP Indonesia, mis. 0812 3456 7890." : nil
    }

    /// 628xxxx → 08xxxx di kolom isian, sebab begitulah orang menulis nomornya sendiri.
    static func untukIsian(_ tersimpan: String?) -> String {
        let t = (tersimpan ?? "").trimmingCharacters(in: .whitespaces)
        return t.hasPrefix("62") ? "0" + t.dropFirst(2) : t
    }
}

/// Padanan `ui/profile/InformasiAkun.kt`.
enum InformasiAkun {
    /// Huruf pertama dari dua kata pertama nama; "SS" bila kosong.
    static func inisial(_ nama: String?) -> String {
        let huruf = (nama ?? "").split(whereSeparator: \.isWhitespace).prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }.joined()
        return huruf.isEmpty ? "SS" : huruf
    }

    /// Teks kosong atau hanya spasi dianggap tidak ada.
    static func teksAtauNil(_ nilai: String?) -> String? {
        guard let t = nilai?.trimmingCharacters(in: .whitespaces), !t.isEmpty else { return nil }
        return t
    }
}
