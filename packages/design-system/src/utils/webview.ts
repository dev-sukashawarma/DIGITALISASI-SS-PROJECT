/**
 * WebView bridge helpers — communicate between the web apps and the React Native
 * Superapp shell (`mobile/superapp`).
 *
 * Two detection paths, by use case:
 *  - `isWebViewUserAgent(ua)`  → SERVER-side layout gating (hide portal header,
 *    apply safe-area). Reads the request User-Agent, so it's decided on the first
 *    byte with NO hydration mismatch.
 *  - `isRunningInWebView()`    → CLIENT-side runtime checks before calling the
 *    bridge. Only true once the native shell has injected the bridge.
 *
 * The native shell only injects `window.ReactNativeWebView` when the `<WebView>`
 * has an `onMessage` prop set — see `mobile/superapp/App.tsx`.
 */

/** Messages the web can send to the native shell. Keep in sync with App.tsx. */
export type NativeBridgeMessage =
  | { type: 'haptic'; style?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' }
  | { type: 'sound'; file: string }

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void }
    __SUKASHAWARMA_NATIVE_APP__?: boolean
  }
}

/** UA token set by the native shell via `applicationNameForUserAgent`. */
const WEBVIEW_UA_TOKEN = 'SukashawarmaApp'

/**
 * Server-safe WebView detection for layout decisions. Pass the request
 * User-Agent (e.g. from `headers().get('user-agent')`). Safe during SSR.
 */
export function isWebViewUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(WEBVIEW_UA_TOKEN)
}

/**
 * Client-side check: are we inside the Superapp WebView with the bridge ready?
 * Returns false during SSR and in a plain browser. For layout gating prefer the
 * server-side `isWebViewUserAgent` to avoid hydration flashes.
 */
export function isRunningInWebView(): boolean {
  return typeof window !== 'undefined' && !!window.ReactNativeWebView
}

/**
 * Send a message to the native shell. No-op (returns false) outside the WebView,
 * so call sites don't need their own guard.
 */
export function postToNative(message: NativeBridgeMessage): boolean {
  if (typeof window === 'undefined' || !window.ReactNativeWebView) return false
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify(message))
    return true
  } catch {
    return false
  }
}
