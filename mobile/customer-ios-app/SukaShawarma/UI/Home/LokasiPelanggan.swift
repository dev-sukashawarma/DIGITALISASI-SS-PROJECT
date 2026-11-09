import CoreLocation

enum HasilLokasi: Equatable, Sendable {
    case ada(Koordinat)
    /// Pelanggan belum/tidak mengizinkan lokasi.
    case tanpaIzin
    /// Izin ada, tapi lokasi mati / tak kunjung didapat.
    case tidakTersedia
}

/// Padanan `ui/home/LokasiPelanggan.kt`: lokasi kasar pelanggan, HANYA untuk
/// mengurutkan outlet terdekat. Akurasi ratusan meter sudah memadai untuk
/// memilih outlet — dan pelanggan boleh memberi "Lokasi Persis: Mati".
///
/// Tidak pernah disimpan dan tidak pernah dikirim ke gateway.
@MainActor
final class LokasiPelanggan: NSObject, CLLocationManagerDelegate {
    // Longgar dengan sengaja: untuk mengurutkan outlet se-kota, lokasi 30 menit
    // lalu hampir selalu cukup, dan memakainya langsung menghindari 5-10 dtk
    // menunggu — selama itu daftar A-Z bisa berubah urutan di bawah jari.
    private static let segarDetik: TimeInterval = 30 * 60
    private static let batasTungguDetik: Double = 10

    private let lm = CLLocationManager()
    /// Mati di skenario uji UI: dialog izin sistem menutupi layar yang diuji.
    private let nonaktif: Bool
    private var tungguIzin: [CheckedContinuation<Void, Never>] = []
    private var tungguLokasi: CheckedContinuation<Koordinat?, Never>?
    private var nomorPermintaan = 0

    init(nonaktif: Bool = false) {
        self.nonaktif = nonaktif
        super.init()
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var punyaIzin: Bool {
        !nonaktif && [.authorizedWhenInUse, .authorizedAlways].contains(lm.authorizationStatus)
    }

    /// Dialog sistem masih bisa muncul. Setelah ditolak, iOS tak akan pernah
    /// menampilkannya lagi — satu-satunya jalan adalah Pengaturan.
    var bisaDitanya: Bool { !nonaktif && lm.authorizationStatus == .notDetermined }

    /// Menampilkan dialog izin sistem dan menunggu jawabannya.
    func mintaIzin() async {
        guard bisaDitanya else { return }
        await withCheckedContinuation { c in
            tungguIzin.append(c)
            lm.requestWhenInUseAuthorization()
        }
    }

    func ambil() async -> HasilLokasi {
        guard punyaIzin else { return .tanpaIzin }
        let terakhir = lm.location
        if let t = terakhir, -t.timestamp.timeIntervalSinceNow < Self.segarDetik {
            return .ada(Koordinat(lat: t.coordinate.latitude, lng: t.coordinate.longitude))
        }
        // Lokasi lama lebih baik daripada tidak ada, untuk mengurutkan.
        if let baru = await lokasiSekarang() { return .ada(baru) }
        if let t = terakhir { return .ada(Koordinat(lat: t.coordinate.latitude, lng: t.coordinate.longitude)) }
        return .tidakTersedia
    }

    private func lokasiSekarang() async -> Koordinat? {
        selesaikanLokasi(nil) // satu permintaan saja pada satu waktu
        nomorPermintaan += 1
        let nomor = nomorPermintaan
        return await withCheckedContinuation { c in
            tungguLokasi = c
            lm.requestLocation()
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(Self.batasTungguDetik))
                guard let self, self.nomorPermintaan == nomor else { return }
                self.selesaikanLokasi(nil)
            }
        }
    }

    private func selesaikanLokasi(_ k: Koordinat?) {
        guard let c = tungguLokasi else { return }
        tungguLokasi = nil
        c.resume(returning: k)
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        MainActor.assumeIsolated {
            guard status != .notDetermined else { return }
            let menunggu = tungguIzin
            tungguIzin = []
            menunggu.forEach { $0.resume() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let k = locations.last.map { Koordinat(lat: $0.coordinate.latitude, lng: $0.coordinate.longitude) }
        MainActor.assumeIsolated { selesaikanLokasi(k) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        MainActor.assumeIsolated { selesaikanLokasi(nil) }
    }
}
