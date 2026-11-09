import SwiftUI

/// Padanan `PemilihVoucherSheet.kt`: lembar pemilihan voucher dari Ringkasan
/// Pesanan. Daftar dimuat SEKALI saat lembar dibuka (bukan tiap gulir) supaya
/// isinya tak berubah saat pelanggan sedang membaca syaratnya.
struct PemilihVoucherSheet: View {
    let muatDaftar: () async -> GatewayResult<[VoucherDto]>
    let onPilih: (PilihanVoucher) -> Void

    @State private var hasil: GatewayResult<[VoucherDto]>?
    @State private var kode = ""
    @State private var percobaan = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pilih Voucher").font(SukaFont.jakarta(20, weight: .bold)).foregroundStyle(Color.sukaInk)
                .padding(.top, 20)

            Group {
                switch hasil {
                case nil:
                    MemuatState()
                case .gagal(let g)?:
                    ErrorState(galat: g) { percobaan += 1 }
                case .sukses(let daftar)? where daftar.isEmpty:
                    Text("Belum ada voucher untuk keranjang ini.")
                        .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaMuted)
                case .sukses(let daftar)?:
                    ScrollView {
                        VStack(spacing: 10) {
                            ForEach(daftar) { v in
                                KartuVoucher(voucher: v) { onPilih(PilihanVoucher(id: v.id, nama: v.nama)) }
                            }
                        }
                    }
                    .frame(maxHeight: .infinity)
                }
            }

            // Selalu terlihat di bawah, sepanjang apa pun daftarnya.
            Text("Punya kode promo?").font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaInk)
            HStack(spacing: 10) {
                TextField("", text: $kode, prompt: Text("Masukkan kode promo").foregroundStyle(Color.sukaMuted))
                    .font(SukaFont.jakarta(14)).foregroundStyle(Color.sukaInk)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .padding(.horizontal, 14).frame(height: 48)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.sukaBorderSubtle, lineWidth: 1))
                    .accessibilityIdentifier("isian-kode-voucher")
                let bersih = kode.trimmingCharacters(in: .whitespaces).uppercased()
                Button { onPilih(PilihanVoucher(kode: bersih, nama: bersih)) } label: {
                    Text("Pakai").font(SukaFont.jakarta(14, weight: .bold))
                        .foregroundStyle(bersih.isEmpty ? Color(white: 0.35) : Color.sukaInk)
                        .padding(.horizontal, 18).frame(height: 48)
                        .background {
                            if !bersih.isEmpty {
                                RoundedRectangle(cornerRadius: 12).fill(SukaGradien.oranyePrimer)
                            } else {
                                RoundedRectangle(cornerRadius: 12).fill(Color(white: 0.88))
                            }
                        }
                }
                .buttonStyle(.mentul(0.94))
                .disabled(bersih.isEmpty)
            }
        }
        .padding(.horizontal, 20).padding(.bottom, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.sukaCream.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task(id: percobaan) {
            hasil = nil
            hasil = await muatDaftar()
        }
    }
}
