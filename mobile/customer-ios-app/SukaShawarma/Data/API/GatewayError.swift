import Foundation

/// Padanan `data/api/GatewayError.kt`.
enum GatewayError: Error, Sendable {
    /// Gateway menolak dengan alasan yang bisa ditindak. `kode` bisa kode
    /// mesin (`pesanan_kadaluarsa`) atau kalimat bebas — gateway memakai
    /// keduanya. Cocokkan kode mesin dulu; kalau tak dikenal, tampilkan `pesan`.
    case kode(kode: String, pesan: String)
    case jaringan(any Error)
    case server(status: Int)
    case sesiTidakSah
}

/// Amplop hasil panggilan gateway (padanan `GatewayResult`).
enum GatewayResult<T: Sendable>: Sendable {
    case sukses(T)
    case gagal(GatewayError)

    /// Mengubah isi sukses tanpa menyentuh galat (dipakai `Repository`).
    func peta<U: Sendable>(_ ubah: (T) -> U) -> GatewayResult<U> {
        switch self {
        case .sukses(let data): .sukses(ubah(data))
        case .gagal(let galat): .gagal(galat)
        }
    }
}

/// Memetakan balasan gagal ke [GatewayError]. Aturannya identik dengan Android:
/// 401 → sesi tidak sah; ≥500 → server; selain itu `{"error","pesan"}` → kode,
/// dan body yang tak bisa diurai → server (bukan crash).
func petakanGalat(status: Int, body: String?) -> GatewayError {
    if status == 401 { return .sesiTidakSah }
    if status >= 500 { return .server(status: status) }

    guard let data = (body ?? "").data(using: .utf8),
          let objek = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
          let kode = teksPrimitif(objek["error"])
    else { return .server(status: status) }

    return .kode(kode: kode, pesan: teksPrimitif(objek["pesan"]) ?? kode)
}

/// Padanan `jsonPrimitive.contentOrNull`: string atau angka jadi teks,
/// null/objek/array jadi nil.
private func teksPrimitif(_ nilai: Any?) -> String? {
    switch nilai {
    case let s as String: s
    case let n as NSNumber: n.stringValue
    default: nil
    }
}
