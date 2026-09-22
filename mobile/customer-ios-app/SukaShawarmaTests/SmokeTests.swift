import Testing
@testable import SukaShawarma

/// Padanan `SmokeTest.kt`.
struct SmokeTests {
    @Test func konfigurasiBundleTerbaca() {
        let config = AppConfig.dariBundle()
        #expect(config.gatewayBaseURL.scheme == "https")
        #expect(config.gatewayBaseURL.host() == "retail.sukashawarma.com")
        #expect(config.googleWebClientID.hasSuffix(".apps.googleusercontent.com"))
    }
}
