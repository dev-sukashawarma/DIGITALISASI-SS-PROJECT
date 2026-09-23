import Foundation
import Observation

/// Batas jumlah per baris. Cerminan `JUMLAH_MAKS_PER_ITEM` di gateway.
let jumlahMaksPerItem = 99

/// Batas panjang catatan. Gateway memotong di angka yang sama.
let panjangMaksCatatan = 200

struct CartTopping: Codable, Sendable, Equatable, Hashable {
    let menuItemId: String
    let nama: String
    var hargaSatuan: Int64
}

struct CartLine: Codable, Sendable, Equatable {
    let menuItemId: String
    let nama: String
    /// Rupiah penuh (Int64), BUKAN Double: gateway membandingkan `unit_price`
    /// dengan katalog memakai kesamaan PERSIS.
    var hargaSatuan: Int64
    var jumlah: Int
    var catatan: String?
    var toppings: [CartTopping] = []
}

private struct IsiKeranjang: Codable {
    var outletId: String?
    var baris: [CartLine] = []
}

/// Cara keranjang bertahan lintas peluncuran. Dipisah agar bisa diuji.
protocol CartPersistence: AnyObject {
    func muat() -> String?
    func simpan(_ isi: String)
}

/// Padanan `data/CartStore.kt`. `@Observable` supaya layar (Fase 2+) ikut
/// diperbarui saat isi keranjang berubah. Aturan bisnisnya identik dengan
/// Android dan dijaga oleh `CartStoreTests` (porting `CartStoreTest.kt`).
@MainActor
@Observable
final class CartStore {
    @ObservationIgnored private let penyimpan: CartPersistence?
    private var keadaan: IsiKeranjang

    init(penyimpan: CartPersistence?) {
        self.penyimpan = penyimpan
        // Keranjang rusak tidak boleh mematikan aplikasi saat dibuka.
        if let mentah = penyimpan?.muat(),
           let data = mentah.data(using: .utf8),
           let terurai = try? JSONDecoder().decode(IsiKeranjang.self, from: data) {
            keadaan = terurai
        } else {
            keadaan = IsiKeranjang()
        }
    }

    /// Keranjang tanpa penyimpanan. Untuk uji.
    static func diMemori() -> CartStore { CartStore(penyimpan: nil) }

    static func persisten() -> CartStore { CartStore(penyimpan: DefaultsCartPersistence()) }

    private func tulis() {
        guard let penyimpan, let data = try? JSONEncoder().encode(keadaan),
              let teks = String(data: data, encoding: .utf8) else { return }
        penyimpan.simpan(teks)
    }

    func outletId() -> String? { keadaan.outletId }

    /// Berpindah outlet MENGOSONGKAN keranjang dan mengembalikan `true` bila
    /// itu terjadi. `menu_item_id` bersifat per-outlet — membawa isi keranjang
    /// outlet A ke outlet B pasti ditolak gateway tepat di titik bayar.
    @discardableResult
    func pakaiOutlet(_ outletId: String) -> Bool {
        if keadaan.outletId == outletId { return false }
        let adaIsi = !keadaan.baris.isEmpty
        keadaan = IsiKeranjang(outletId: outletId, baris: [])
        tulis()
        return adaIsi
    }

    /// Baris digabung hanya bila id, catatan, DAN topping-nya sama persis.
    func tambah(menuItemId: String, nama: String, hargaSatuan: Int64, jumlah: Int,
                catatan: String?, toppings: [CartTopping] = []) {
        let catatanBersih = rapikanCatatan(catatan)
        let tambahan = min(max(jumlah, 1), jumlahMaksPerItem)

        if let posisi = keadaan.baris.firstIndex(where: {
            $0.menuItemId == menuItemId && $0.catatan == catatanBersih && $0.toppings == toppings
        }) {
            keadaan.baris[posisi].jumlah = min(keadaan.baris[posisi].jumlah + tambahan, jumlahMaksPerItem)
        } else {
            keadaan.baris.append(CartLine(menuItemId: menuItemId, nama: nama, hargaSatuan: hargaSatuan,
                                          jumlah: tambahan, catatan: catatanBersih, toppings: toppings))
        }
        tulis()
    }

    /// Menaikkan atau menurunkan jumlah. Turun sampai nol menghapus barisnya.
    func ubahJumlah(index: Int, delta: Int) {
        guard keadaan.baris.indices.contains(index) else { return }
        let baru = keadaan.baris[index].jumlah + delta
        if baru <= 0 {
            keadaan.baris.remove(at: index)
        } else {
            keadaan.baris[index].jumlah = min(baru, jumlahMaksPerItem)
        }
        tulis()
    }

    /// Menghapus sub-item topping tertentu dari suatu baris pesanan.
    func hapusTopping(index: Int, toppingMenuItemId: String) {
        guard keadaan.baris.indices.contains(index) else { return }
        keadaan.baris[index].toppings.removeAll { $0.menuItemId == toppingMenuItemId }
        tulis()
    }

    func hapus(index: Int) {
        guard keadaan.baris.indices.contains(index) else { return }
        keadaan.baris.remove(at: index)
        tulis()
    }

    /// Membuang SEMUA baris satu menu (sebagai item utama maupun topping).
    /// Dipakai saat gateway melaporkan item habis/tidak ada.
    func hapusMenuItem(_ menuItemId: String) {
        keadaan.baris = keadaan.baris
            .filter { $0.menuItemId != menuItemId }
            .map { line in
                var l = line
                l.toppings.removeAll { $0.menuItemId == menuItemId }
                return l
            }
        tulis()
    }

    /// Menyetel harga satu menu ke harga terbaru dari gateway. Dipanggil HANYA
    /// setelah pelanggan melihat harga baru dan menyetujuinya sendiri.
    func perbaruiHarga(menuItemId: String, hargaBaru: Int64) {
        keadaan.baris = keadaan.baris.map { line in
            var l = line
            if l.menuItemId == menuItemId { l.hargaSatuan = hargaBaru }
            l.toppings = l.toppings.map { t in
                var top = t
                if top.menuItemId == menuItemId { top.hargaSatuan = hargaBaru }
                return top
            }
            return l
        }
        tulis()
    }

    func isi() -> [CartLine] { keadaan.baris }

    func kosongkan() {
        keadaan.baris = []
        tulis()
    }

    func subtotal() -> Int64 {
        keadaan.baris.reduce(0) { total, line in
            let perPorsi = line.hargaSatuan + line.toppings.reduce(0) { $0 + $1.hargaSatuan }
            return total + perPorsi * Int64(line.jumlah)
        }
    }

    func jumlahPorsi() -> Int { keadaan.baris.reduce(0) { $0 + $1.jumlah } }
}

/// Memotong catatan di 200 karakter DI APLIKASI (pelanggan melihat batasnya
/// sendiri) dan membuang `|NOTE|` yang merusak struk dapur.
func rapikanCatatan(_ catatan: String?) -> String? {
    guard let catatan else { return nil }
    let bersih = String(catatan.replacingOccurrences(of: "|NOTE|", with: " ")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .prefix(panjangMaksCatatan))
    return bersih.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : bersih
}

private final class DefaultsCartPersistence: CartPersistence {
    private let defaults = UserDefaults(suiteName: "suka_customer_cart") ?? .standard
    func muat() -> String? { defaults.string(forKey: "isi") }
    func simpan(_ isi: String) { defaults.set(isi, forKey: "isi") }
}
