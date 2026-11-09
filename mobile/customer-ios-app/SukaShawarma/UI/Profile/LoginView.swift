import AuthenticationServices
import SwiftUI

/// Padanan `LoginScreen.kt`: masuk dengan Google, dan (khusus iOS) Apple.
/// Didesain ulang agar bersih, simpel, elegan, dan menenangkan mata.
struct LoginView: View {
    @State var vm: LoginViewModel
    let googleClientID: String
    let onBerhasil: () -> Void
    var onKembali: (() -> Void)?

    @Environment(\.webAuthenticationSession) private var sesiWeb
    @Environment(AppContainer.self) private var container
    private let sudutTombol: CGFloat = 16
    @State private var nonceApple = ""
    @State private var animasiMasuk = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.sukaCanvas.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 20)

                    // Hero Ilustrasi Bersih & Berkelas
                    HeroIlustrasiLogin()
                        .scaleEffect(animasiMasuk ? 1.0 : 0.94)
                        .opacity(animasiMasuk ? 1.0 : 0.0)
                        .animation(.spring(response: 0.6, dampingFraction: 0.78), value: animasiMasuk)

                    // Judul & Subjudul Sambutan
                    VStack(spacing: 8) {
                        Text("Selamat Datang!")
                            .font(SukaFont.lilita(32))
                            .foregroundStyle(Color.sukaBrown)
                            .accessibilityAddTraits(.isHeader)

                        Text("Masuk untuk memesan tanpa antre dan memantau pesananmu secara langsung.")
                            .font(SukaFont.jakarta(14))
                            .foregroundStyle(Color.sukaMuted)
                            .multilineTextAlignment(.center)
                            .lineSpacing(4)
                            .padding(.horizontal, 16)
                    }
                    .padding(.top, 12)

                    // Kartu Tombol Masuk yang Simpel & Rapi
                    VStack(spacing: 14) {
                        tombolGoogle
                        tombolApple
                        #if DEBUG
                        tombolDemo
                        #endif
                    }
                    .padding(.top, 28)
                    .disabled(vm.memuat != nil)

                    // Ketentuan Privasi
                    Text("Dengan masuk, kamu menyetujui Ketentuan Layanan & Kebijakan Privasi Suka Shawarma.")
                        .font(SukaFont.jakarta(11))
                        .foregroundStyle(Color.sukaMuted.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                        .padding(.horizontal, 16)
                        .padding(.top, 14)

                    // Kotak Galat jika ada
                    if let pesan = vm.pesanGalat {
                        KotakGalat(pesan: pesan, onTutup: vm.bersihkanGalat)
                            .padding(.top, 16)
                            .transition(.opacity.combined(with: .scale(scale: 0.96)))
                    }

                    // Pemisah
                    PemisahAtau()
                        .padding(.top, 26)

                    // WhatsApp Pill (Segera Hadir)
                    TombolWhatsAppSegera()
                        .padding(.top, 14)

                    // Keterangan Pembuatan Akun Otomatis
                    (Text("Belum punya akun? ").foregroundStyle(Color.sukaMuted)
                     + Text("Akun dibuat otomatis").foregroundStyle(Color.sukaOrangeTeks).bold()
                     + Text(" saat kamu masuk pertama kali.").foregroundStyle(Color.sukaMuted))
                        .font(SukaFont.jakarta(12))
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                        .padding(.top, 26)
                        .padding(.bottom, 24)
                }
                .padding(.horizontal, 24)
            }

            // Tombol Kembali melayang di kiri atas
            if let onKembali {
                Button(action: onKembali) {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.sukaBrown)
                        .frame(width: 42, height: 42)
                        .background(Color.white, in: Circle())
                        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
                }
                .buttonStyle(.mentul(0.92))
                .accessibilityLabel("Kembali")
                .padding(.leading, 16)
                .padding(.top, 8)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            container.ikonBilahStatusGelap = true
            withAnimation { animasiMasuk = true }
        }
        .onDisappear { container.ikonBilahStatusGelap = false }
        .onChange(of: vm.berhasil) { _, ok in if ok { onBerhasil() } }
    }

    // MARK: - Google Button

    private var tombolGoogle: some View {
        Button { Task { await masukGoogle() } } label: {
            HStack(spacing: 12) {
                if vm.memuat == .google {
                    ProgressView().tint(Color.sukaInk)
                    Text("Menghubungkan akun…")
                        .font(SukaFont.jakarta(15, weight: .bold))
                } else {
                    ZStack {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 28, height: 28)
                            .shadow(color: .black.opacity(0.08), radius: 2)
                        Text("G")
                            .font(.system(size: 16, weight: .black, design: .rounded))
                            .foregroundStyle(Color(hex: 0x4285F4))
                    }
                    Text("Masuk dengan Google")
                        .font(SukaFont.jakarta(15, weight: .bold))
                }
            }
            .foregroundStyle(Color.sukaInk)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Color.sukaOrange, in: RoundedRectangle(cornerRadius: sudutTombol))
            .shadow(color: Color.sukaOrange.opacity(0.35), radius: 8, x: 0, y: 3)
        }
        .buttonStyle(.mentul(0.97))
        .accessibilityIdentifier("tombol-masuk-google")
    }

    private func masukGoogle() async {
        guard !googleClientID.isEmpty else {
            vm.gagalSebelumGateway("Masuk dengan Google belum diaktifkan di versi iOS ini.")
            return
        }
        vm.mulai(.google)
        let pkce = MasukGoogle.PKCE.baru()
        let state = MasukApple.nonceBaru()
        do {
            let url = MasukGoogle.urlOtorisasi(clientID: googleClientID, pkce: pkce, state: state)
            let callback = try await sesiWeb.authenticate(using: url,
                                                          callbackURLScheme: MasukGoogle.skemaBalik(googleClientID),
                                                          preferredBrowserSession: .shared)
            let kode = try MasukGoogle.kodeDari(callback: callback, stateDiharapkan: state)
            let token = try await MasukGoogle.tukarKode(kode, clientID: googleClientID, pkce: pkce)
            await vm.tukarGoogle(idToken: token)
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            vm.dibatalkan()
        } catch MasukGoogle.Galat.ditolak("access_denied") {
            vm.dibatalkan()
        } catch {
            vm.gagalSebelumGateway("Gagal membuka akun Google. Coba lagi sebentar lagi.")
        }
    }

    // MARK: - Apple Button

    private var tombolApple: some View {
        SignInWithAppleButton(.signIn) { req in
            let nonce = MasukApple.nonceBaru()
            nonceApple = nonce
            req.requestedScopes = [.fullName, .email]
            req.nonce = MasukApple.sha256Hex(nonce)
            vm.mulai(.apple)
        } onCompletion: { hasil in
            switch hasil {
            case .success(let auth):
                guard let kredensial = auth.credential as? ASAuthorizationAppleIDCredential,
                      let data = kredensial.identityToken, let token = String(data: data, encoding: .utf8)
                else { vm.gagalSebelumGateway("Apple tidak mengirim identitas. Coba lagi."); return }
                let nama = MasukApple.namaLengkap(kredensial.fullName)
                Task { await vm.tukarApple(idToken: token, nonce: nonceApple, nama: nama) }
            case .failure(let e as ASAuthorizationError) where e.code == .canceled:
                vm.dibatalkan()
            case .failure:
                vm.gagalSebelumGateway("Gagal membuka Apple ID. Coba lagi sebentar lagi.")
            }
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 52)
        .clipShape(RoundedRectangle(cornerRadius: sudutTombol))
        .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 3)
        .overlay {
            if vm.memuat == .apple {
                RoundedRectangle(cornerRadius: sudutTombol).fill(.black.opacity(0.65))
                ProgressView().tint(.white)
            }
        }
        .accessibilityIdentifier("tombol-masuk-apple")
    }

    #if DEBUG
    // MARK: - Demo Button (Untuk Pengujian & Simulator)

    private var tombolDemo: some View {
        Button {
            vm.masukModeDemo()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.sukaOrange)
                Text("Masuk Akun Pengujian (Demo)")
                    .font(SukaFont.jakarta(14, weight: .bold))
                    .foregroundStyle(Color.sukaInk)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(Color.white, in: RoundedRectangle(cornerRadius: sudutTombol))
            .overlay(RoundedRectangle(cornerRadius: sudutTombol).stroke(Color.sukaOrange.opacity(0.4), lineWidth: 1.2))
            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
        }
        .buttonStyle(.mentul(0.97))
        .accessibilityIdentifier("tombol-masuk-demo")
    }
    #endif
}

/// Hero ilustrasi bersih: Maskot dengan aura radial lembut
private struct HeroIlustrasiLogin: View {
    @State private var bernapas = false

    var body: some View {
        ZStack {
            // Aura radial hangat lembut
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.sukaOrange.opacity(bernapas ? 0.22 : 0.12), Color.clear],
                        center: .center,
                        startRadius: 20,
                        endRadius: 130
                    )
                )
                .frame(width: 260, height: 260)
                .scaleEffect(bernapas ? 1.08 : 0.95)
                .animation(.easeInOut(duration: 2.8).repeatForever(autoreverses: true), value: bernapas)

            Image("IlustrasiLogin")
                .resizable()
                .scaledToFit()
                .frame(width: 210, height: 210)
        }
        .frame(height: 240)
        .accessibilityHidden(true)
        .onAppear { bernapas = true }
    }
}

/// WhatsApp Segera Hadir: Desain pill elegan dan bersih
private struct TombolWhatsAppSegera: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "phone.fill")
                .font(.system(size: 13))
                .foregroundStyle(Color.sukaMuted)
            Text("WhatsApp · segera hadir")
                .font(SukaFont.jakarta(13, weight: .semibold))
                .foregroundStyle(Color.sukaMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 46)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.black.opacity(0.06), lineWidth: 0.8)
        )
        .accessibilityElement(children: .combine)
        .accessibilityHint("Belum tersedia")
    }
}

/// Garis Pemisah "atau" yang halus
private struct PemisahAtau: View {
    var body: some View {
        HStack(spacing: 14) {
            Rectangle().fill(Color.black.opacity(0.08)).frame(height: 1)
            Text("atau")
                .font(SukaFont.jakarta(12, weight: .medium))
                .foregroundStyle(Color.sukaMuted.opacity(0.8))
            Rectangle().fill(Color.black.opacity(0.08)).frame(height: 1)
        }
        .accessibilityHidden(true)
    }
}

/// Kotak galat berdesain modern
private struct KotakGalat: View {
    let pesan: String
    let onTutup: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: 0xB91C1C))

            Text(pesan)
                .font(SukaFont.jakarta(12, weight: .medium))
                .foregroundStyle(Color(hex: 0x991B1B))
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier("pesan-galat-masuk")

            Button(action: onTutup) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(hex: 0xB91C1C))
                    .frame(width: 32, height: 32)
            }
            .accessibilityLabel("Tutup pesan")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(hex: 0xFEF2F2), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(hex: 0xFCA5A5), lineWidth: 0.8))
    }
}
