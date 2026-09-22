import SwiftUI

/// Padanan `OutletPickerScreen.kt`. Tampil sebagai lembar layar penuh.
///
/// Label jarak ("📍 850 m"), "Bogor & Sekitarnya", dan jam buka di kartu
/// adalah teks statis di Android dan disalin apa adanya — belum dihitung dari data.
struct OutletPickerView: View {
    @State var vm: OutletPickerViewModel
    let onPilih: (OutletDto) -> Void
    let onTutup: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            kepala
            VStack(spacing: 0) {
                bannerLokasi
                HStack {
                    Text("OUTLET TERDEKAT").font(SukaFont.jakarta(11, weight: .bold)).tracking(0.5).foregroundStyle(Color.sukaBrown)
                    Spacer()
                    Text("\(vm.tampil.count) Outlet").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                }
                .padding(.horizontal, 18).padding(.vertical, 4)

                daftar.frame(maxHeight: .infinity)
            }
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .task { await vm.muat() }
    }

    private var kepala: some View {
        VStack(spacing: 6) {
            HStack {
                Button(action: onTutup) {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        .frame(width: 40, height: 40).background(Color.white, in: Circle())
                }
                .buttonStyle(.mentul())
                .accessibilityLabel("Tutup")
                Spacer()
                VStack(spacing: 2) {
                    Text("Pilih Outlet").font(SukaFont.jakarta(17, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    HStack(spacing: 4) {
                        Circle().fill(Color.sukaOrange).frame(width: 6, height: 6)
                        Text("Khusus Ambil Sendiri (Self-Pickup)").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                }
                Spacer()
                Image(systemName: "location.fill").font(.system(size: 15)).foregroundStyle(Color.sukaOrange)
                    .frame(width: 40, height: 40).background(Color.white, in: Circle())
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16).padding(.top, 10)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(Color.sukaOrange)
                TextField("", text: $vm.kueri,
                          prompt: Text("Cari outlet, nama jalan, atau area...").foregroundStyle(Color.sukaMuted))
                    .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaInk).autocorrectionDisabled()
                if !vm.kueri.isEmpty {
                    Button { vm.kueri = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Color.sukaMuted) }
                        .accessibilityLabel("Hapus pencarian")
                }
            }
            .padding(.horizontal, 14).frame(height: 48)
            .background(Color.white, in: Capsule())
            .overlay(Capsule().stroke(Color.sukaBorder, lineWidth: 1))
            .padding(.horizontal, 16).padding(.vertical, 6)
        }
        .background(Color.sukaCream.shadow(.drop(color: .black.opacity(0.06), radius: 1, y: 1)))
    }

    private var bannerLokasi: some View {
        HStack {
            HStack(spacing: 10) {
                Image(systemName: "mappin").font(.system(size: 14, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    .frame(width: 32, height: 32).background(Color.sukaOrange.opacity(0.2), in: Circle())
                VStack(alignment: .leading, spacing: 0) {
                    Text("LOKASIMU SAAT INI").font(SukaFont.jakarta(9, weight: .bold)).tracking(0.5).foregroundStyle(Color(hex: 0x8A4822))
                    Text("Bogor & Sekitarnya").font(SukaFont.jakarta(12, weight: .bold)).foregroundStyle(Color.sukaInk)
                }
            }
            Spacer()
            Text("Otomatis").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(Color.sukaBrown)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.sukaOrange.opacity(0.3), lineWidth: 1))
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(LinearGradient(colors: [Color(hex: 0xFFF1E5), Color(hex: 0xFFE8D6)], startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: 0xFCDDC2), lineWidth: 1))
        .padding(.horizontal, 16).padding(.vertical, 8)
    }

    @ViewBuilder private var daftar: some View {
        if vm.memuat {
            MemuatState().frame(maxHeight: .infinity)
        } else if let galat = vm.galat {
            ErrorState(galat: galat) { Task { await vm.muat() } }.frame(maxHeight: .infinity)
        } else if vm.tampil.isEmpty && !vm.kueri.trimmingCharacters(in: .whitespaces).isEmpty {
            EmptyState(judul: "Tidak Ditemukan", penjelasan: "Tidak ada outlet yang cocok dengan \"\(vm.kueri)\".")
                .frame(maxHeight: .infinity)
        } else if vm.tampil.isEmpty {
            EmptyState(judul: "Belum Ada Outlet", penjelasan: "Pemesanan lewat aplikasi belum dibuka di outlet mana pun.")
                .frame(maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(vm.tampil) { o in KartuOutlet(outlet: o) { onPilih(o) } }
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
            }
            .scrollDismissesKeyboard(.immediately)
        }
    }
}

private struct KartuOutlet: View {
    let outlet: OutletDto
    let onPilih: () -> Void

    var body: some View {
        Button(action: onPilih) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(outlet.name).font(SukaFont.jakarta(15, weight: .bold)).foregroundStyle(Color.sukaInk).lineLimit(1)
                        HStack(spacing: 6) {
                            HStack(spacing: 4) {
                                Circle().fill(outlet.isActive ? Color.sukaGreen : Color.sukaMuted).frame(width: 6, height: 6)
                                Text(outlet.isActive ? "Buka • Siap 15–20 mnt" : "Belum Buka")
                                    .font(SukaFont.jakarta(10, weight: .bold))
                                    .foregroundStyle(outlet.isActive ? Color.sukaGreen : Color.sukaMuted)
                            }
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(outlet.isActive ? Color(hex: 0xE8F8F0) : Color(hex: 0xF3F4F6), in: RoundedRectangle(cornerRadius: 8))
                            Text("📍 850 m").font(SukaFont.jakarta(10, weight: .bold)).foregroundStyle(Color.sukaBrown)
                                .padding(.horizontal, 6).padding(.vertical, 3)
                                .background(Color(hex: 0xFFEBD8), in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    Spacer()
                    Image(systemName: "checkmark").font(.system(size: 11, weight: .bold))
                        .foregroundStyle(outlet.isActive ? Color.sukaBrown : .clear)
                        .frame(width: 24, height: 24)
                        .background(outlet.isActive ? Color.sukaOrange : Color(hex: 0xE5E7EB), in: Circle())
                }
                if let alamat = outlet.address, !alamat.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text(alamat).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted).lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Rectangle().fill(Color(hex: 0xF5EADB)).frame(height: 1)
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "clock").font(.system(size: 11)).foregroundStyle(Color.sukaOrange)
                        Text("Buka: 10.00 – 22.00 WIB").font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                    }
                    Spacer()
                    Text("Pilih Outlet →").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaBrown)
                }
            }
            .padding(16)
            .kartuSuka(sudut: 20, elevasi: 2)
        }
        .buttonStyle(.mentul(0.98))
        .accessibilityLabel("\(outlet.name), \(outlet.isActive ? "buka" : "belum buka")")
    }
}
