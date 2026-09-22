import Testing
@testable import SukaShawarma

@MainActor
struct ItemDetailViewModelTests {
    @Test func jumlahDibatasi1Sampai99() {
        let vm = ItemDetailViewModel()
        vm.ubahJumlah(-5)
        #expect(vm.jumlah == 1)
        vm.ubahJumlah(500)
        #expect(vm.jumlah == 99)
    }

    @Test func catatanDipotongSaatDiketik() {
        let vm = ItemDetailViewModel()
        vm.catatan = String(repeating: "x", count: 250)
        #expect(vm.catatan.count == 200)
    }

    @Test func toppingBisaDipilihDanDibatalkan() {
        let vm = ItemDetailViewModel()
        vm.toggleTopping("t1"); vm.toggleTopping("t2"); vm.toggleTopping("t1")
        #expect(vm.toppingTerpilih == ["t2"])
    }
}
