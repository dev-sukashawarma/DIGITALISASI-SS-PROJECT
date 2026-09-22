import Foundation

/// Padanan `BuildConfig` Android. Nilai berasal dari `Config/Base.xcconfig`
/// (bisa ditimpa `Local.xcconfig`) lewat `Info.plist`.
struct AppConfig: Sendable, Equatable {
    let gatewayBaseURL: URL
    let googleWebClientID: String
    /// Kosong sampai iOS client ID dibuat di Google Cloud (Fase 2).
    let googleIOSClientID: String

    static let bawaanGateway = URL(string: "https://retail.sukashawarma.com")!

    static func dariBundle(_ bundle: Bundle = .main) -> AppConfig {
        func baca(_ kunci: String) -> String {
            (bundle.object(forInfoDictionaryKey: kunci) as? String)?
                .trimmingCharacters(in: .whitespaces) ?? ""
        }
        return AppConfig(
            gatewayBaseURL: URL(string: baca("GatewayBaseURL")) ?? bawaanGateway,
            googleWebClientID: baca("GoogleWebClientID"),
            googleIOSClientID: baca("GoogleIOSClientID")
        )
    }
}
