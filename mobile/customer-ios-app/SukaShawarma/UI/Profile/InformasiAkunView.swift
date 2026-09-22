import SwiftUI

/// Padanan `InformasiAkunScreen.kt`: Nama, Email (terkunci), No WhatsApp.
/// Nama yang diubah di sini TIDAK ditimpa Google saat masuk berikutnya
/// (gateway hanya mengisi nama yang masih kosong).
struct InformasiAkunView: View {
    @State var vm: InformasiAkunViewModel
    let onKembali: () -> Void

    @FocusState private var fokus: KolomAkun?

    var body: some View {
        VStack(spacing: 0) {
            PageBrandHeader(judul: "Informasi Akun", subjudul: "Data akun pelangganmu", onKembali: onKembali)
            ScrollView {
                VStack(spacing: 16) {
                    Text(InformasiAkun.inisial(vm.namaTersimpan))
                        .font(SukaFont.lilita(28)).foregroundStyle(Color.sukaInk)
                        .frame(width: 72, height: 72).background(Color.sukaOrange, in: Circle())
                        .padding(.vertical, 8)
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 16) {
                        Isian(label: "Nama", ikon: "person.fill", nilai: $vm.nama, galat: vm.galatNama,
                              placeholder: "Nama lengkapmu", fokus: $fokus, kolom: .nama,
                              papan: .default, jenisIsi: .name) { fokus = .whatsApp }

                        EmailTerkunci(email: vm.email)

                        Isian(label: "No WhatsApp", ikon: "phone.fill", nilai: $vm.whatsApp, galat: vm.galatWhatsApp,
                              placeholder: "0812 3456 7890",
                              keterangan: "Dipakai outlet untuk menghubungimu soal pesanan.",
                              fokus: $fokus, kolom: .whatsApp, papan: .phonePad, jenisIsi: .telephoneNumber) {
                            fokus = nil
                            Task { await vm.simpan() }
                        }
                    }
                    .padding(16)
                    .kartuSuka(sudut: 20, elevasi: 0)

                    if let pesan = vm.pesanGalat {
                        Text(pesan).font(SukaFont.jakarta(13)).foregroundStyle(Color(hex: 0xB3261E))
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
                    }
                    if vm.tersimpan && !vm.adaPerubahan {
                        Label("Perubahan tersimpan.", systemImage: "checkmark.circle.fill")
                            .font(SukaFont.jakarta(13)).foregroundStyle(Color.sukaGreen)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
                            .accessibilityIdentifier("pesan-tersimpan")
                    }

                    let aktif = vm.adaPerubahan && !vm.menyimpan
                    Button {
                        fokus = nil
                        Task { await vm.simpan() }
                    } label: {
                        ZStack {
                            if vm.menyimpan { ProgressView().tint(Color.sukaInk) }
                            else { Text("Simpan").font(SukaFont.jakarta(16, weight: .bold)) }
                        }
                        .foregroundStyle(aktif ? Color.sukaInk : Color.sukaMuted)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(aktif ? Color.sukaOrange : Color.sukaTint, in: Capsule())
                    }
                    .buttonStyle(.mentul())
                    .disabled(!aktif)
                    .accessibilityIdentifier("tombol-simpan-profil")
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Color.sukaCream.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .toolbar {
            // Papan nomor telepon iOS tak punya tombol "Selesai"/"Enter".
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Selesai") { fokus = nil }.font(SukaFont.jakarta(15, weight: .bold))
            }
        }
        .task { await vm.segarkan() }
    }
}

fileprivate enum KolomAkun { case nama, whatsApp }

private struct LabelIsian: View {
    let teks: String
    var body: some View {
        Text(teks).font(SukaFont.jakarta(13, weight: .bold)).foregroundStyle(Color.sukaBrown).padding(.horizontal, 4)
    }
}

private struct Isian: View {
    let label: String
    let ikon: String
    @Binding var nilai: String
    let galat: String?
    let placeholder: String
    var keterangan: String?
    var fokus: FocusState<KolomAkun?>.Binding
    let kolom: KolomAkun
    let papan: UIKeyboardType
    let jenisIsi: UITextContentType
    let onKirim: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            LabelIsian(teks: label)
            HStack(spacing: 12) {
                Image(systemName: ikon).font(.system(size: 16)).foregroundStyle(Color.sukaBrown).frame(width: 20)
                TextField("", text: $nilai, prompt: Text(placeholder).foregroundStyle(Color.sukaMuted))
                    .font(SukaFont.jakarta(15)).foregroundStyle(Color.sukaInk)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(kolom == .nama ? .words : .never)
                    .keyboardType(papan)
                    .textContentType(jenisIsi)
                    .submitLabel(kolom == .nama ? .next : .done)
                    .focused(fokus, equals: kolom)
                    .onSubmit(onKirim)
                    .accessibilityIdentifier(kolom == .nama ? "isian-nama" : "isian-whatsapp")
                    .accessibilityLabel(label)
            }
            .padding(.horizontal, 16).frame(minHeight: 54)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(galat != nil ? Color(hex: 0xB3261E) : Color.sukaBorder, lineWidth: galat != nil ? 2 : 1))
            if let bawah = galat ?? keterangan {
                Text(bawah).font(SukaFont.jakarta(12))
                    .foregroundStyle(galat != nil ? Color(hex: 0xB3261E) : Color.sukaMuted)
                    .padding(.horizontal, 4)
            }
        }
    }
}

private struct EmailTerkunci: View {
    let email: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            LabelIsian(teks: "Email")
            HStack(spacing: 12) {
                Image(systemName: "envelope.fill").font(.system(size: 16)).foregroundStyle(Color.sukaBrown).frame(width: 20)
                Text(email ?? "—").font(SukaFont.jakarta(15)).foregroundStyle(Color.sukaInk).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "lock.fill").font(.system(size: 13)).foregroundStyle(Color.sukaMuted)
                    .accessibilityLabel("Tidak bisa diubah")
            }
            .padding(16)
            .background(Color.sukaTint, in: RoundedRectangle(cornerRadius: 12))
            Text("Email akun Google yang dipakai untuk masuk, tidak bisa diubah.")
                .font(SukaFont.jakarta(12)).foregroundStyle(Color.sukaMuted).padding(.horizontal, 4)
        }
    }
}
