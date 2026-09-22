import SwiftUI

/// Padanan `ui/cart/CartScreen.kt`. Membaca `CartStore` langsung — ia
/// `@Observable`, jadi tak perlu `CartViewModel.segarkan()` seperti Android:
/// setiap layar otomatis mengikuti satu sumber kebenaran yang sama.
struct CartView: View {
    let cart: CartStore
    let onKembali: () -> Void
    let onLanjutBayar: () -> Void

    var body: some View {
        let baris = cart.isi()
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Keranjang Pesanan",
                            subjudul: cart.jumlahPorsi() > 0 ? "\(cart.jumlahPorsi()) item dipilih" : nil,
                            onKembali: onKembali)
            if baris.isEmpty {
                EmptyState(judul: "Keranjang masih kosong",
                           penjelasan: "Pilih shawarma favoritmu dari katalog untuk mulai memesan.")
                    .frame(maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        KartuPickup(judul: "PESANAN PICKUP (AMBIL SENDIRI)", keterangan: "Siap diambil di outlet tanpa antrean")
                        ForEach(Array(baris.enumerated()), id: \.offset) { i, b in
                            BarisKeranjang(baris: b,
                                           onKurang: { cart.ubahJumlah(index: i, delta: -1) },
                                           onTambah: { cart.ubahJumlah(index: i, delta: 1) },
                                           onHapusTopping: { cart.hapusTopping(index: i, toppingMenuItemId: $0) })
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Ringkasan Pembayaran").font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
                            BarisRingkasan(label: "Subtotal Item", nilai: rupiah(cart.subtotal()))
                            BarisRingkasan(label: "Biaya Pengambilan (Pickup)", nilai: "GRATIS", warnaNilai: .sukaGreen)
                            Divider().overlay(Color.sukaBorder.opacity(0.5))
                            BarisRingkasan(label: "Total Tagihan", nilai: rupiah(cart.subtotal()), warnaNilai: .sukaBrown, tebal: true)
                        }
                        .padding(16)
                        .kartuSuka(sudut: 18, elevasi: 0, tepi: .sukaBorder.opacity(0.8))
                        .padding(.top, 8).padding(.bottom, 16)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .animation(.easeOut(duration: 0.2), value: baris)
                }
                BilahBawah {
                    HStack {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Total Pembayaran").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                            Text(rupiah(cart.subtotal())).font(SukaFont.lilita(19)).foregroundStyle(Color.sukaBrown)
                                .contentTransition(.numericText())
                        }
                        Spacer()
                        TombolAksi(label: "Lanjut Pembayaran", ikonKanan: "arrow.right", aksi: onLanjutBayar)
                            .accessibilityIdentifier("tombol-lanjut-bayar")
                    }
                }
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }
}

private struct BarisKeranjang: View {
    let baris: CartLine
    let onKurang: () -> Void
    let onTambah: () -> Void
    let onHapusTopping: (String) -> Void

    private var totalBaris: Int64 {
        (baris.hargaSatuan + baris.toppings.reduce(0) { $0 + $1.hargaSatuan }) * Int64(baris.jumlah)
    }

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(baris.nama).font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk).lineLimit(2)
                    if let c = baris.catatan, !c.isEmpty {
                        Text("\"\(c)\"").font(SukaFont.jakarta(11)).italic().foregroundStyle(Color.sukaMuted).lineLimit(2)
                    }
                    Text(rupiah(baris.hargaSatuan * Int64(baris.jumlah))).font(SukaFont.jakarta(15, weight: .bold))
                        .foregroundStyle(Color.sukaBrown)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 6) {
                    Button(action: onKurang) {
                        // Jumlah 1: tombol kurang berubah jadi hapus (turun ke 0 = baris dihapus).
                        Image(systemName: baris.jumlah <= 1 ? "trash" : "minus")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(baris.jumlah <= 1 ? Color.red.opacity(0.8) : Color.sukaInk)
                            .frame(width: 26, height: 26).background(Color.white, in: Circle())
                    }
                    .buttonStyle(.mentul(0.88))
                    .accessibilityLabel(baris.jumlah <= 1 ? "Hapus \(baris.nama)" : "Kurangi \(baris.nama)")
                    Text("\(baris.jumlah)").font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
                        .frame(minWidth: 18).contentTransition(.numericText())
                    Button(action: onTambah) {
                        Image(systemName: "plus").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.sukaInk)
                            .frame(width: 26, height: 26).background(Color.sukaOrange, in: Circle())
                    }
                    .buttonStyle(.mentul(0.88))
                    .disabled(baris.jumlah >= jumlahMaksPerItem)
                    .accessibilityLabel("Tambah \(baris.nama)")
                }
                .padding(.horizontal, 6).padding(.vertical, 3)
                .background(Color.sukaTint, in: Capsule())
                .overlay(Capsule().stroke(Color.sukaBorder, lineWidth: 1))
            }

            if !baris.toppings.isEmpty {
                VStack(spacing: 6) {
                    ForEach(baris.toppings, id: \.menuItemId) { t in
                        HStack(spacing: 6) {
                            Text("+ \(t.nama)").font(SukaFont.jakarta(12, weight: .medium)).foregroundStyle(Color.sukaInk)
                            Text("(+\(rupiah(t.hargaSatuan * Int64(baris.jumlah))))").font(SukaFont.jakarta(11, weight: .bold))
                                .foregroundStyle(Color.sukaBrown)
                            Spacer()
                            Button { onHapusTopping(t.menuItemId) } label: {
                                Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.sukaMuted)
                                    .frame(width: 22, height: 22).background(Color.white, in: Circle())
                                    .overlay(Circle().stroke(Color.sukaBorder.opacity(0.7), lineWidth: 1))
                            }
                            .buttonStyle(.mentul(0.85))
                            .accessibilityLabel("Hapus topping \(t.nama)")
                        }
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Color.sukaTint.opacity(0.55), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.sukaBorder.opacity(0.5), lineWidth: 1))

                HStack {
                    Text("Total Item & Topping").font(SukaFont.jakarta(12, weight: .medium)).foregroundStyle(Color.sukaMuted)
                    Spacer()
                    Text(rupiah(totalBaris)).font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaBrown)
                }
                .padding(.horizontal, 4)
            }
        }
        .padding(14)
        .kartuSuka(sudut: 18, elevasi: 2, tepi: .sukaBorder.opacity(0.7))
    }
}
