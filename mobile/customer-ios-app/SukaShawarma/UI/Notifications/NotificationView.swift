import SwiftUI

/// Padanan `NotificationScreen.kt`.
struct NotificationView: View {
    @State var vm: NotificationViewModel
    let onBukaStatusPesanan: (String) -> Void
    let onBukaMenu: () -> Void
    let onKembali: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Notifikasi",
                            subjudul: vm.unreadCount > 0 ? "\(vm.unreadCount) belum dibaca" : "Kotak Masuk & Promo",
                            onKembali: onKembali)
            HStack(spacing: 8) {
                ForEach(KategoriNotifikasi.allCases, id: \.self) { k in
                    let pilih = vm.tab == k
                    Button { vm.tab = k } label: {
                        Text(k.label).font(SukaFont.jakarta(12, weight: pilih ? .bold : .medium))
                            .foregroundStyle(pilih ? Color.sukaInk : Color.sukaBody)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(pilih ? Color.sukaOrange : .white, in: Capsule())
                            .overlay(Capsule().stroke(pilih ? Color.sukaOrange : Color.sukaBorder, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(pilih ? .isSelected : [])
                }
                Spacer(minLength: 0)
                if vm.unreadCount > 0 {
                    Button { Task { await vm.tandaiSemuaDibaca() } } label: {
                        Label("Baca Semua", systemImage: "checkmark.circle").font(SukaFont.jakarta(11, weight: .bold))
                            .foregroundStyle(Color.sukaBrown)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            isi.frame(maxHeight: .infinity)
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await vm.muat() }
    }

    @ViewBuilder private var isi: some View {
        if vm.memuat {
            MemuatState()
        } else if let g = vm.galat, vm.semua.isEmpty {
            ErrorState(galat: g) { Task { await vm.muat() } }
        } else if vm.tampil.isEmpty {
            switch vm.tab {
            case .semua: EmptyState(judul: "Belum Ada Notifikasi",
                                    penjelasan: "Semua pembaruan status pesanan dan promosi spesial akan masuk ke sini.")
            case .pesanan: EmptyState(judul: "Tidak Ada Info Pesanan",
                                      penjelasan: "Notifikasi proses pembuatan dan siap ambil akan tampil saat kamu memesan.")
            case .promo: EmptyState(judul: "Belum Ada Promo Aktif",
                                    penjelasan: "Nantikan voucher diskon dan penawaran menarik berikutnya!")
            }
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(vm.tampil) { n in
                        KartuNotifikasi(notif: n) {
                            Task { await vm.tandaiDibaca(n.id) }
                            if let id = n.orderId { onBukaStatusPesanan(id) } else if n.type == "promo" { onBukaMenu() }
                        }
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 16)
            }
            .refreshable { await vm.muat() }
        }
    }
}

private struct KartuNotifikasi: View {
    let notif: NotificationDto
    let onKlik: () -> Void

    private var siap: Bool { notif.title.localizedCaseInsensitiveContains("Siap") }
    private var warna: Color {
        switch notif.type {
        case "order_status": siap ? .sukaGreen : .sukaOrange
        case "reminder": Color(hex: 0xE11D48)
        case "promo": Color(hex: 0xD97706)
        default: .sukaOrange
        }
    }
    private var ikon: String {
        switch notif.type {
        case "order_status": siap ? "checkmark.circle.fill" : "fork.knife"
        case "reminder": "alarm.fill"
        case "promo": "tag.fill"
        default: "bell.fill"
        }
    }

    var body: some View {
        Button(action: onKlik) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: ikon).font(.system(size: 17)).foregroundStyle(warna)
                    .frame(width: 42, height: 42).background(warna.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .top) {
                        Text(notif.title).font(SukaFont.jakarta(14, weight: notif.isRead ? .medium : .bold)).foregroundStyle(Color.sukaInk)
                        Spacer()
                        if !notif.isRead { Circle().fill(Color.sukaOrange).frame(width: 8, height: 8).padding(.top, 4) }
                    }
                    Text(notif.body).font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaBody)
                    if let w = formatWaktuPendek(notif.createdAt) {
                        Text(w).font(SukaFont.jakarta(10)).foregroundStyle(Color.sukaMuted)
                    }
                    if notif.orderId != nil {
                        Text("Lihat detail pesanan →").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    } else if notif.type == "promo" {
                        Text("Buka katalog menu →").font(SukaFont.jakarta(11, weight: .bold)).foregroundStyle(Color.sukaBrown)
                    }
                }
                .multilineTextAlignment(.leading)
            }
            .padding(14)
            .kartuSuka(sudut: 18, elevasi: notif.isRead ? 0 : 2, latar: notif.isRead ? .white : Color(hex: 0xFFFCF8),
                       tepi: notif.isRead ? .sukaBorder : Color.sukaOrange.opacity(0.4))
        }
        .buttonStyle(.mentul(0.98))
        .accessibilityHint(notif.isRead ? "" : "Belum dibaca")
    }
}

/// Padanan `NotificationSettingsDialog.kt` — sebagai lembar bawah (idiom iOS).
struct PengaturanNotifikasiSheet: View {
    @State var statusPesanan: Bool
    @State var promo: Bool
    let onSimpan: (Bool, Bool) -> Void
    @Environment(\.dismiss) private var tutup

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Pengaturan Notifikasi").font(SukaFont.lilita(20)).foregroundStyle(Color.sukaBrown)
                Text("Kelola notifikasi yang ingin kamu terima").font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted)
            }
            Toggle(isOn: $statusPesanan) {
                teks("Status Pesanan & Pengambilan",
                     "Pemberitahuan saat pesanan sedang dibuat, siap diambil di kasir, dan pengingat.")
            }
            Toggle(isOn: $promo) {
                teks("Promo & Penawaran Spesial", "Diskon eksklusif, voucher reward, dan informasi menu musiman.")
            }
            Spacer(minLength: 0)
            TombolAksi(label: "Simpan Perubahan") {
                onSimpan(statusPesanan, promo)
                tutup()
            }
            .frame(maxWidth: .infinity)
        }
        .tint(Color.sukaOrange)
        .padding(24)
        .presentationDetents([.medium])
        .presentationBackground(Color.sukaCream)
    }

    private func teks(_ j: String, _ s: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(j).font(SukaFont.jakarta(14, weight: .bold)).foregroundStyle(Color.sukaInk)
            Text(s).font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
        }
    }
}
