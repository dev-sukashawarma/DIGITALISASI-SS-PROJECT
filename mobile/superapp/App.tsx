import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  BackHandler,
  Platform,
  StatusBar,
  ActivityIndicator,
  Text,
  SafeAreaView,
  Vibration,
  Animated,
  Image,
} from 'react-native';
import WebView, {
  type WebViewNavigation,
  type WebViewMessageEvent,
} from 'react-native-webview';
import * as SplashScreen from 'expo-splash-screen';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// ─── Push Notification Handler ─────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Konfigurasi ───────────────────────────────────────────────
const PORTAL_URL = 'https://app.sukashawarma.com';

// Daftar domain yang diizinkan (subdomain Sukashawarma).
// Navigasi ke domain di luar daftar ini akan dibuka di browser eksternal.
const ALLOWED_DOMAINS = [
  'app.sukashawarma.com',
  'absensi.sukashawarma.com',
  'pos.sukashawarma.com',
  'stok.sukashawarma.com',
  'distribusi.sukashawarma.com',
  'owner.sukashawarma.com',
  'admin.sukashawarma.com',
];

// ─── Splash Screen ────────────────────────────────────────────
// Tahan Splash Screen sampai web selesai dimuat
SplashScreen.preventAutoHideAsync();

// ─── Registrasi Push Notification Native ──────────────────────
async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found in Constants.expoConfig.extra.eas.projectId');
      }
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.error('Error fetching Expo Push Token:', e);
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}

export default function App() {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const webViewRef = useRef<WebView<{}> | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [initialUri, setInitialUri] = useState(PORTAL_URL);

  // State untuk custom animated splash overlay
  const [isSplashActive, setIsSplashActive] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashScale = useRef(new Animated.Value(1)).current;

  // ─── Handler Tombol Back Android ─────────────────────────────
  // Jika WebView bisa mundur → mundur 1 halaman
  // Jika tidak bisa → keluar dari aplikasi
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Mencegah aplikasi tertutup
      }
      return false; // Biarkan Android menutup aplikasi
    });

    return () => backHandler.remove();
  }, [canGoBack]);

  // ─── Bridge Helper: Kirim Token ke WebView ───────────────────
  const sendTokenToWebView = useCallback((token: string) => {
    if (!webViewRef.current) return;
    const jsCode = `
      (function() {
        window.__SUKASHAWARMA_NATIVE_PUSH_TOKEN__ = "${token}";
        window.dispatchEvent(new CustomEvent('nativePushToken', { detail: "${token}" }));
        window.postMessage({ type: 'push-token', token: "${token}" }, '*');
        true;
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, []);

  // ─── Setup Push Notifications & Click Handlers ────────────────
  useEffect(() => {
    // 1. Ambil token push secara asinkron
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        console.log('Expo Push Token:', token);
      }
    });

    // 2. Cek apakah app dibuka dari keadaan tertutup (cold launch) via klik notifikasi
    Notifications.getLastNotificationResponseAsync().then(response => {
      const url = response?.notification.request.content.data?.url as string | undefined;
      if (url) {
        const targetUrl = url.startsWith('http') ? url : `${PORTAL_URL}${url.startsWith('/') ? '' : '/'}${url}`;
        setInitialUri(targetUrl);
      }
    });

    // 3. Listener untuk menangani klik notifikasi saat app sedang aktif (foreground/background)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) {
        const targetUrl = url.startsWith('http') ? url : `${PORTAL_URL}${url.startsWith('/') ? '' : '/'}${url}`;
        webViewRef.current?.injectJavaScript(`window.location.href = "${targetUrl}";`);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  // Kirim token ke WebView secara otomatis saat token tersedia dan loading web selesai
  useEffect(() => {
    if (expoPushToken && !isLoading) {
      sendTokenToWebView(expoPushToken);
    }
  }, [expoPushToken, isLoading, sendTokenToWebView]);

  // ─── Callback saat navigasi berubah ──────────────────────────
  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  // ─── Callback saat web selesai dimuat ────────────────────────
  const onLoadEnd = useCallback(() => {
    // Sembunyikan native splash screen bawaan Expo secara instan
    SplashScreen.hideAsync();

    // Jalankan animasi transisi fade-out dan zoom-in halus pada custom overlay kita
    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 650, // Durasi 650ms transisi memudar
        useNativeDriver: true,
      }),
      Animated.timing(splashScale, {
        toValue: 1.12, // Zoom-in halus 12%
        duration: 650,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsSplashActive(false); // Unmount overlay dari view tree
      setIsLoading(false);
    });
  }, [splashOpacity, splashScale]);

  // ─── Callback error ──────────────────────────────────────────
  const onError = useCallback(() => {
    setHasError(true);
    setIsSplashActive(false);
    setIsLoading(false);
    SplashScreen.hideAsync();
  }, []);

  // ─── Cegah navigasi ke luar domain Sukashawarma ──────────────
  const onShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    try {
      const url = new URL(request.url);
      // Izinkan navigasi ke domain Sukashawarma
      if (ALLOWED_DOMAINS.some(domain => url.hostname === domain)) {
        return true;
      }
      // Izinkan blob dan data URLs (untuk download file, dll)
      if (request.url.startsWith('blob:') || request.url.startsWith('data:')) {
        return true;
      }
      // Blokir navigasi ke domain luar (akan dibuka di browser eksternal)
      return false;
    } catch {
      return true;
    }
  }, []);

  // ─── Retry saat error ────────────────────────────────────────
  const onRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  // ─── JavaScript yang di-inject SEBELUM konten dimuat ─────────
  // Dijalankan saat document element dibuat, sebelum web hydrate — jadi
  // window.__SUKASHAWARMA_NATIVE_APP__ sudah ada saat first paint (tak ada
  // flash/hydration mismatch). injectedJavaScript biasa berjalan SETELAH load.
  const injectedJavaScriptBeforeContentLoaded = `
    (function() {
      // Beri tahu web bahwa ini native app (dipakai untuk gating UI client-side)
      window.__SUKASHAWARMA_NATIVE_APP__ = true;

      // Injeksi token push jika sudah tersedia lebih awal
      ${expoPushToken ? `window.__SUKASHAWARMA_NATIVE_PUSH_TOKEN__ = "${expoPushToken}";` : ''}

      // Cegah banner "Install PWA" muncul di dalam native app
      window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
      });

      // Override navigator.standalone agar terdeteksi sebagai installed
      Object.defineProperty(navigator, 'standalone', {
        get: function() { return true; }
      });

      true; // Required oleh React Native WebView
    })();
  `;

  // ─── Bridge: pesan dari Web → Native ─────────────────────────
  // CATATAN: prop onMessage WAJIB ada agar react-native-webview meng-inject
  // window.ReactNativeWebView.postMessage ke halaman web. Tanpa ini, bridge
  // (dan injectedJavaScript) tidak terpasang. Protokol pesan sinkron dengan
  // `postToNative()` di @suka/design-system.
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let msg: { type?: string; style?: string; file?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return; // abaikan pesan non-JSON
    }

    switch (msg.type) {
      case 'haptic': {
        // Pakai Vibration core RN (tanpa dependensi tambahan).
        const patterns: Record<string, number | number[]> = {
          light: 15,
          medium: 30,
          heavy: 50,
          success: [0, 30, 60, 30],
          warning: [0, 40, 80, 40],
          error: [0, 60, 40, 60],
        };
        Vibration.vibrate(patterns[msg.style ?? 'medium'] ?? 25);
        break;
      }
      case 'sound':
        // TODO: pemutaran suara native butuh modul audio Expo.
        // Jalankan `npx expo install expo-audio` lalu putar `msg.file`.
        // Sampai itu, halaman web bisa fallback memutar audio sendiri.
        break;
      case 'get-push-token': {
        if (expoPushToken) {
          sendTokenToWebView(expoPushToken);
        } else {
          registerForPushNotificationsAsync().then(token => {
            if (token) {
              setExpoPushToken(token);
              sendTokenToWebView(token);
            }
          });
        }
        break;
      }
    }
  }, []);

  // ─── Tampilan Error ──────────────────────────────────────────
  if (hasError) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Text style={styles.errorEmoji}>📡</Text>
        <Text style={styles.errorTitle}>Tidak Ada Koneksi</Text>
        <Text style={styles.errorMessage}>
          Pastikan HP Anda terhubung ke internet, lalu coba lagi.
        </Text>
        <Text style={styles.retryButton} onPress={onRetry}>
          🔄 Coba Lagi
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      <WebView
        ref={webViewRef}
        source={{ uri: initialUri }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={onLoadEnd}
        onError={onError}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}

        // ─── Izin Kamera & Mikrofon (untuk Face Recognition) ───
        mediaCapturePermissionGrantType="grant"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}

        // ─── Performa & Pengalaman ─────────────────────────────
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={true}
        allowsBackForwardNavigationGestures={true}

        // ─── Pengaturan Android Spesifik ───────────────────────
        mixedContentMode="compatibility"
        allowFileAccess={true}
        geolocationEnabled={true}
        setSupportMultipleWindows={false}

        // ─── User Agent Custom ─────────────────────────────────
        // Menambahkan identifier agar server bisa mendeteksi native app
        applicationNameForUserAgent="SukashawarmaApp/1.0"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Memuat Sukashawarma...</Text>
        </View>
      )}

      {/* Custom Animated Splash Overlay */}
      {isSplashActive && (
        <Animated.View style={[styles.splashOverlay, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
          <Image
            source={require('./assets/splash.png')}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF', // Menyamakan warna background splash screen
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999, // Menjamin berada di atas webview & loading spinner
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
