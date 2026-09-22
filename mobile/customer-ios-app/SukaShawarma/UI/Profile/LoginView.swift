import AuthenticationServices
import SwiftUI

/// Padanan `LoginScreen.kt`: masuk dengan Google, dan (khusus iOS) Apple.
///
/// Pedoman App Store 4.8: aplikasi yang menawarkan masuk Google WAJIB juga
/// menawarkan Sign in with Apple dengan penonjolan setara — karena itu kedua
/// tombol berukuran sama. Tombol "WhatsApp · segera hadir" di Android tidak
/// disalin (tombol mati).
struct LoginView: View {
    @State var vm: LoginViewModel
    let googleClientID: String
    let onBerhasil: () -> Void
    var onKembali: (() -> Void)?

    @Environment(\.webAuthenticationSession) private var sesiWeb
    @State private var nonceApple = ""

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.sukaCream.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    IlustrasiSambutan().padding(.top, 24)
                    Text("Selamat Datang!").font(SukaFont.lilita(30)).foregroundStyle(Color.sukaBrown)
                        .accessibilityAddTraits(.isHeader)
                    Text("Masuk untuk memesan tanpa antre dan memantau pesananmu.")
                        .font(SukaFont.jakarta(14)).foregroundStyle(Color.sukaMuted)
                        .multilineTextAlignment(.center).padding(.horizontal, 12).padding(.top, 8)

                    VStack(spacing: 12) {
                        tombolGoogle
                        tombolApple
                    }
                    .padding(.top, 32)
                    .disabled(vm.memuat != nil)

                    Text("Dengan masuk, kamu menyetujui Ketentuan Layanan & Kebijakan Privasi Suka Shawarma.")
                        .font(SukaFont.jakarta(11)).foregroundStyle(Color.sukaMuted)
                        .multilineTextAlignment(.center).padding(.horizontal, 8).padding(.top, 12)

                    if let pesan = vm.pesanGalat {
                        HStack(alignment: .top, spacing: 8) {
                            Text(pesan).font(SukaFont.jakarta(13)).foregroundStyle(Color(hex: 0x991B1B))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityIdentifier("pesan-galat-masuk")
                            Button(action: vm.bersihkanGalat) {
                                Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Color(hex: 0x991B1B))
                                    .frame(width: 32, height: 32)
                            }
                            .accessibilityLabel("Tutup pesan")
                        }
                        .padding(.leading, 14).padding(.vertical, 6).padding(.trailing, 4)
                        .background(Color(hex: 0xFEE2E2), in: RoundedRectangle(cornerRadius: 14))
                        .padding(.top, 12)
                    }

                    (Text("Belum punya akun? ").foregroundStyle(Color.sukaMuted)
                     + Text("Akun dibuat otomatis").foregroundStyle(Color.sukaOrangeTeks).bold()
                     + Text(" saat kamu masuk pertama kali.").foregroundStyle(Color.sukaMuted))
                        .font(SukaFont.jakarta(12)).multilineTextAlignment(.center).padding(.top, 28)
                }
                .padding(.horizontal, 24).padding(.bottom, 24)
            }

            if let onKembali {
                Button(action: onKembali) {
                    Image(systemName: "chevron.left").font(.system(size: 16, weight: .bold)).foregroundStyle(Color.sukaBrown)
                        .frame(width: 40, height: 40).background(Color.white, in: Circle()).frame(width: 48, height: 48)
                }
                .buttonStyle(.mentul())
                .accessibilityLabel("Kembali")
                .padding(.leading, 8)
            }
        }
        .latarBilahStatus()
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: vm.berhasil) { _, ok in if ok { onBerhasil() } }
    }

    // MARK: Google

    private var tombolGoogle: some View {
        Button { Task { await masukGoogle() } } label: {
            HStack(spacing: 10) {
                if vm.memuat == .google {
                    ProgressView().tint(Color.sukaInk)
                    Text("Menghubungkan akun…")
                } else {
                    Text("G").font(.system(size: 18, weight: .heavy, design: .rounded)).foregroundStyle(Color(hex: 0x4285F4))
                        .frame(width: 28, height: 28).background(Color.white, in: Circle())
                    Text("Masuk dengan Google")
                }
            }
            .font(SukaFont.jakarta(16, weight: .bold)).foregroundStyle(Color.sukaInk)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Color.sukaOrange, in: Capsule())
        }
        .buttonStyle(.mentul())
        .accessibilityIdentifier("tombol-masuk-google")
    }

    private func masukGoogle() async {
        guard !googleClientID.isEmpty else {
            // GOOGLE_IOS_CLIENT_ID di Base.xcconfig masih kosong (RANCANGAN.md §5 butir 1).
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

    // MARK: Apple

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
        .clipShape(Capsule())
        .overlay { if vm.memuat == .apple { Capsule().fill(.black.opacity(0.6)); ProgressView().tint(.white) } }
        .accessibilityIdentifier("tombol-masuk-apple")
    }
}

/// Ilustrasi sambutan: gambar maskot di atas lingkaran & titik dekoratif.
private struct IlustrasiSambutan: View {
    @State private var melayang = false

    var body: some View {
        ZStack {
            Circle().fill(Color.sukaTint).frame(width: 190, height: 190).offset(y: 12)
            Circle().stroke(Color.sukaOrange.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: [4, 6]))
                .frame(width: 214, height: 214).offset(y: 12)
            Circle().fill(Color.sukaOrange).frame(width: 14, height: 14).offset(x: 88, y: 4)
            Circle().fill(Color.sukaGreen.opacity(0.7)).frame(width: 10, height: 10).offset(x: -92, y: 26)
            Circle().fill(Color.sukaBrown.opacity(0.35)).frame(width: 8, height: 8).offset(x: -48, y: -84)
            Image("IlustrasiLogin").resizable().scaledToFit().frame(width: 200, height: 200)
                .offset(y: melayang ? -6 : 4)
        }
        .frame(height: 240)
        .accessibilityHidden(true)
        .onAppear {
            withAnimation(.easeInOut(duration: 2.2).repeatForever(autoreverses: true)) { melayang = true }
        }
    }
}
