import SwiftUI

/// Padanan `ItemDetailScreen.kt`: jumlah, topping, catatan, lalu tambah ke keranjang.
///
/// Tombol "Bagikan" di kepala Android tidak melakukan apa-apa (no-op), jadi
/// sengaja TIDAK disalin — tombol mati terbaca sebagai aplikasi rusak.
struct ItemDetailView: View {
    let item: MenuItemDto
    let toppingTersedia: [MenuItemDto]
    let cart: CartStore
    let onLihatKeranjang: () -> Void
    let onKembali: () -> Void

    @State private var vm = ItemDetailViewModel()

    private var toppingDipilih: [MenuItemDto] { toppingTersedia.filter { vm.toppingTerpilih.contains($0.id) } }
    private var totalItem: Int64 {
        bulatkanRupiah((item.price + toppingDipilih.reduce(0) { $0 + $1.price }) * Double(vm.jumlah))
    }

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Detail Menu", subjudul: item.name, onKembali: onKembali)
            ScrollView {
                VStack(spacing: 16) {
                    gambarUtama
                    kartuInfo
                    if !toppingTersedia.isEmpty { kartuTopping }
                    kartuCatatan
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
            }
            .scrollDismissesKeyboard(.interactively)
            bilahBawah
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }

    private var gambarUtama: some View {
        GambarJarak(url: item.imageUrl, ikonCadangan: "fork.knife", ukuranIkon: 52)
            .frame(height: 230)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.sukaBorder.opacity(0.8), lineWidth: 1))
            .overlay(alignment: .topLeading) {
                Text("🔥 Terlaris").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color.sukaBrown, in: RoundedRectangle(cornerRadius: 10))
                    .padding(14)
            }
            .accessibilityLabel(item.name)
    }

    private var kartuInfo: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(item.name).font(SukaFont.jakarta(20, weight: .bold)).foregroundStyle(Color.sukaInk)
            if let d = item.description, !d.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(d).font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted)
            }
            HStack {
                Text(rupiah(item.price)).font(SukaFont.lilita(20)).foregroundStyle(Color.sukaBrown)
                Spacer()
                stepper
            }
            .padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kartuSuka(sudut: 20, elevasi: 2, tepi: .sukaBorder.opacity(0.7))
    }

    private var stepper: some View {
        HStack(spacing: 8) {
            Button { vm.ubahJumlah(-1) } label: {
                Image(systemName: "minus").font(.system(size: 13, weight: .bold))
                    .foregroundStyle(vm.jumlah > 1 ? Color.sukaInk : Color.sukaMuted.opacity(0.4))
                    .frame(width: 28, height: 28)
                    .background(vm.jumlah > 1 ? Color.white : .clear, in: Circle())
            }
            .buttonStyle(.mentul(0.88))
            .disabled(vm.jumlah <= 1)
            .accessibilityLabel("Kurangi")
            Text("\(vm.jumlah)").font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk)
                .frame(minWidth: 24)
                .contentTransition(.numericText())
            Button { vm.ubahJumlah(1) } label: {
                Image(systemName: "plus").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.sukaInk)
                    .frame(width: 28, height: 28).background(Color.sukaOrange, in: Circle())
            }
            .buttonStyle(.mentul(0.88))
            .disabled(vm.jumlah >= jumlahMaksPerItem)
            .accessibilityLabel("Tambah")
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(Color.sukaTint, in: Capsule())
        .overlay(Capsule().stroke(Color.sukaBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Jumlah \(vm.jumlah)")
    }

    private var kartuTopping: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Tambahan Topping").font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk)
                    Text("Pilih topping ekstra favoritmu").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                }
                Spacer()
                Text("Opsional").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 8))
            }
            ForEach(toppingTersedia) { t in
                let dipilih = vm.toppingTerpilih.contains(t.id)
                Button { vm.toggleTopping(t.id) } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "checkmark").font(.system(size: 12, weight: .bold))
                            .foregroundStyle(dipilih ? .white : .clear)
                            .frame(width: 22, height: 22)
                            .background(dipilih ? Color.sukaOrange : .clear, in: RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6)
                                .stroke(dipilih ? Color.sukaOrange : Color.sukaMuted.opacity(0.5), lineWidth: 1.5))
                        VStack(alignment: .leading, spacing: 0) {
                            Text(t.name).font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
                            if let d = t.description, !d.trimmingCharacters(in: .whitespaces).isEmpty {
                                Text(d).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                            }
                        }
                        Spacer()
                        Text("+\(rupiah(t.price))").font(SukaFont.jakarta(13, weight: .bold))
                            .foregroundStyle(dipilih ? Color.sukaOrangeTeks : Color.sukaBrown)
                    }
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(dipilih ? Color.sukaTint : .white, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14)
                        .stroke(dipilih ? Color.sukaOrange : Color.sukaBorder.opacity(0.8), lineWidth: 1.5))
                }
                .buttonStyle(.mentul(0.98))
                .accessibilityAddTraits(dipilih ? .isSelected : [])
            }
        }
        .padding(18)
        .kartuSuka(sudut: 20, elevasi: 2, tepi: .sukaBorder.opacity(0.7))
    }

    private var kartuCatatan: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Catatan Tambahan").font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk)
            TextField("", text: $vm.catatan,
                      prompt: Text("Contoh: Jangan terlalu pedas, saus garlic dipisah...").foregroundStyle(Color.sukaMuted),
                      axis: .vertical)
                .lineLimit(1...3)
                .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaInk)
                .padding(12)
                .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.sukaBorder, lineWidth: 1))
            Text("\(vm.catatan.count)/\(panjangMaksCatatan) karakter").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
        }
        .padding(18)
        .kartuSuka(sudut: 20, elevasi: 2, tepi: .sukaBorder.opacity(0.7))
    }

    private var bilahBawah: some View {
        let porsiKeranjang = cart.jumlahPorsi()
        let subtotalKeranjang = cart.subtotal()
        return VStack(spacing: 10) {
            if porsiKeranjang > 0 {
                Button(action: onLihatKeranjang) {
                    HStack {
                        HStack(spacing: 6) {
                            Image(systemName: "bag.fill").font(.system(size: 13)).foregroundStyle(Color.sukaOrange)
                            Text("\(porsiKeranjang) item di keranjang • \(rupiah(subtotalKeranjang))")
                                .font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        }
                        Spacer()
                        HStack(spacing: 2) {
                            Text("Lihat").font(SukaFont.jakarta(11, weight: .bold))
                            Image(systemName: "arrow.right").font(.system(size: 10, weight: .bold))
                        }
                        .foregroundStyle(Color.sukaOrangeTeks)
                    }
                    .padding(.vertical, 4)
                }
                Divider().overlay(Color.sukaBorder.opacity(0.5))
            }
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(porsiKeranjang > 0 ? "Total Belanja (+Item ini)" : "Total Harga")
                        .font(SukaFont.jakarta(11, weight: .medium)).foregroundStyle(Color.sukaMuted)
                    Text(rupiah(porsiKeranjang > 0 ? subtotalKeranjang + totalItem : totalItem))
                        .font(SukaFont.lilita(19)).foregroundStyle(Color.sukaBrown)
                        .contentTransition(.numericText())
                    if porsiKeranjang > 0 {
                        Text("Item ini: +\(rupiah(totalItem))").font(SukaFont.jakarta(10, weight: .medium)).foregroundStyle(Color.sukaMuted)
                    }
                }
                Spacer()
                Button(action: tambah) {
                    Text(item.isAvailable ? "+ Keranjang" : "Habis").font(SukaFont.jakarta(14, weight: .bold))
                        .foregroundStyle(item.isAvailable ? Color.sukaInk : Color(white: 0.3))
                        .padding(.horizontal, 24).padding(.vertical, 14)
                        .background(item.isAvailable ? Color.sukaOrange : Color(white: 0.83), in: RoundedRectangle(cornerRadius: 20))
                }
                .buttonStyle(.mentul(0.94))
                .disabled(!item.isAvailable)
                .accessibilityIdentifier("tombol-tambah-keranjang")
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background {
            UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                .fill(Color.white)
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                    .stroke(Color.sukaBorder.opacity(0.6), lineWidth: 1))
                .shadow(color: .black.opacity(0.10), radius: 14, y: -3)
                .ignoresSafeArea(edges: .bottom)
        }
    }

    private func tambah() {
        guard item.isAvailable else { return }
        let catatan = vm.catatan.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : vm.catatan
        cart.tambah(
            menuItemId: item.id,
            nama: item.name,
            // Rupiah tak punya pecahan; dibulatkan SEKALI di sini (kesamaan persis di gateway).
            hargaSatuan: bulatkanRupiah(item.price),
            jumlah: vm.jumlah,
            catatan: catatan,
            toppings: toppingDipilih.map {
                CartTopping(menuItemId: $0.id, nama: $0.name, hargaSatuan: bulatkanRupiah($0.price))
            })
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        onKembali()
    }
}
