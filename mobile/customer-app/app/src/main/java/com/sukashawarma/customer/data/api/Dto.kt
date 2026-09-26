package com.sukashawarma.customer.data.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Bentuk balasan gateway dicerminkan PERSIS dari
// apps/retail-gateway/src/app/api/v1/**/route.ts — jangan mengarang nama
// field. `pickup_code` sengaja TIDAK ADA di sini: dibuang dari seluruh
// balasan gateway, pesanan sekarang memakai `pos_order_number`.

@Serializable
data class GoogleAuthRequest(
    @SerialName("id_token") val idToken: String
)

@Serializable
data class CustomerDto(
    val id: String,
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null
)

@Serializable
data class AuthResponse(
    val token: String,
    @SerialName("expires_at") val expiresAt: String,
    val customer: CustomerDto
)

@Serializable
data class OutletDto(
    val id: String,
    val name: String,
    val address: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    @SerialName("is_active") val isActive: Boolean,
    // Field tahap 1 (2026-09-24). Opsional: gateway lama tak mengirimnya.
    @SerialName("bisa_pesan") val bisaPesan: Boolean? = null,
    @SerialName("pesan_status") val pesanStatus: String? = null,
    @SerialName("pesan_terakhir") val pesanTerakhir: String? = null,
)

@Serializable
data class OutletsResponse(
    val outlets: List<OutletDto>
)

@Serializable
data class MenuItemDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val price: Double,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_available") val isAvailable: Boolean,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
    // Nama kategori dikirim gateway sejak commit "kirim nama kategori bersama
    // katalog". Default null supaya aplikasi versi ini tetap jalan melawan
    // gateway yang belum di-redeploy: judul kelompok hilang, menu tetap tampil.
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("category_sort_order") val categorySortOrder: Int? = null
)

@Serializable
data class CatalogResponse(
    val items: List<MenuItemDto>
)

// `urutan` sengaja TIDAK dideklarasikan di sini: urutan carousel sudah
// dibawa oleh urutan array JSON-nya sendiri, dan `Json { ignoreUnknownKeys
// = true }` (GatewayClient) membuang field itu dengan aman.
@Serializable
data class BannerDto(
    val id: String,
    val badge: String? = null,
    val judul: String,
    val subjudul: String? = null,
    @SerialName("teks_tombol") val teksTombol: String? = null,
    @SerialName("gambar_url") val gambarUrl: String? = null,
    val aksi: String = "tidak_ada",
    @SerialName("target_menu_item_id") val targetMenuItemId: String? = null
)

/** Pengaturan splash aplikasi dari `GET /api/v1/splash`. `gambarUrl` null = pakai gambar bawaan APK. */
@Serializable
data class SplashDto(
    @SerialName("gambar_url") val gambarUrl: String? = null,
    @SerialName("durasi_ms") val durasiMs: Int = 3000
)

@Serializable
data class ConfigDto(
    @SerialName("estimasi_siap") val estimasiSiap: String = "15–20 menit",
    @SerialName("wa_cs") val waCs: String? = null,
    @SerialName("versi_minimum_android") val versiMinimumAndroid: Int = 1,
    @SerialName("url_syarat") val urlSyarat: String? = null,
    @SerialName("url_privasi") val urlPrivasi: String? = null,
)

@Serializable
data class BannersResponse(
    val carousel: List<BannerDto> = emptyList(),
    val popup: BannerDto? = null
)

@Serializable
data class CartItemPayload(
    @SerialName("menu_item_id") val menuItemId: String,
    val name: String,
    @SerialName("unit_price") val unitPrice: Double,
    val quantity: Int,
    val note: String? = null
)

@Serializable
data class CheckoutValidateRequest(
    @SerialName("outlet_id") val outletId: String,
    val items: List<CartItemPayload>,
    @SerialName("voucher_id") val voucherId: String? = null,
    @SerialName("kode_voucher") val kodeVoucher: String? = null
)

/**
 * `discountAmount` sengaja camelCase — checkout/validate tidak konsisten
 * dengan endpoint lain (snake_case). Ketidakseragaman nyata di gateway,
 * dicerminkan apa adanya, bukan "diperbaiki" di sisi Android.
 */
@Serializable
data class CartProblemDto(
    @SerialName("menu_item_id") val menuItemId: String,
    val name: String,
    val jenis: String,
    @SerialName("harga_baru") val hargaBaru: Double? = null
)

/**
 * Rincian voucher yang dikembalikan `checkout/validate`. `status = 'tidak_ada'`
 * berarti tidak ada voucher yang dipilih -- gateway tetap mengirim blok ini
 * hanya bila pemanggil menyertakan `voucher_id`/`kode_voucher` di permintaan.
 */
@Serializable
data class VoucherCheckoutDto(
    val id: String? = null,
    val nama: String? = null,
    val status: String,
    val alasan: String? = null,
    val potongan: Double = 0.0,
    @SerialName("item_gratis") val itemGratis: List<CartItemPayload> = emptyList()
)

@Serializable
data class CheckoutValidateResponse(
    val ok: Boolean,
    val subtotal: Double? = null,
    val discountAmount: Double? = null,
    val total: Double? = null,
    val alasan: String? = null,
    val pesan: String? = null,
    val masalah: List<CartProblemDto>? = null,
    val voucher: VoucherCheckoutDto? = null
)

@Serializable
data class CreateOrderRequest(
    @SerialName("client_order_id") val clientOrderId: String,
    @SerialName("outlet_id") val outletId: String,
    val items: List<CartItemPayload>,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("voucher_id") val voucherId: String? = null,
    @SerialName("kode_voucher") val kodeVoucher: String? = null
)

/** Satu voucher dari `GET/POST /api/v1/vouchers`, berikut kelayakan pakainya. */
@Serializable
data class VoucherDto(
    val id: String,
    val nama: String,
    val deskripsi: String? = null,
    val jenis: String,
    @SerialName("kalimat_syarat") val kalimatSyarat: String,
    val selesai: String? = null,
    val status: String,
    val alasan: String? = null
)

@Serializable
data class VouchersRequest(
    @SerialName("outlet_id") val outletId: String? = null,
    val items: List<CartItemPayload>? = null
)

@Serializable
data class VouchersResponse(
    val vouchers: List<VoucherDto>
)

@Serializable
data class CreateOrderResponse(
    @SerialName("order_id") val orderId: String,
    @SerialName("payment_url") val paymentUrl: String? = null,
    @SerialName("total_amount") val totalAmount: Double,
    @SerialName("expires_at") val expiresAt: String,
    // Teks mentah QRIS. Aplikasi menggambar sendiri kodenya; `payment_url`
    // hanya terisi bila gateway jatuh ke jalur Invoice.
    @SerialName("qr_string") val qrString: String? = null,
    val duplicate: Boolean? = null
)

@Serializable
data class OrderDetailDto(
    val id: String,
    val status: String,
    @SerialName("status_dapur") val statusDapur: String? = null,
    @SerialName("total_amount") val totalAmount: Double,
    // `Int`, bukan `String`. Kolomnya `pos_order_number int` di
    // retail.order_drafts, dan gateway meneruskannya apa adanya sebagai angka
    // JSON. Dideklarasikan String, kotlinx-serialization melempar saat
    // menguraikannya -- dan karena pengurai dipanggil di dalam try/catch klien,
    // kegagalannya menyamar jadi "galat jaringan". Layar status dan riwayat
    // akan SELALU gagal, dengan pesan yang menuduh koneksi pelanggan.
    @SerialName("pos_order_number") val posOrderNumber: Int? = null,
    @SerialName("outlet_name") val outletName: String? = null,
    @SerialName("created_at") val createdAt: String,
    // Default null supaya aplikasi ini tetap jalan melawan gateway yang belum
    // di-redeploy. Ketiadaannya diperlakukan sebagai "tidak diketahui", dan
    // percobaan lama TIDAK dibuang atas dasar tebakan.
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("payment_url") val paymentUrl: String? = null,
    @SerialName("qr_string") val qrString: String? = null
)

@Serializable
data class OrdersListResponse(
    val orders: List<OrderDetailDto>
)

@Serializable
data class NotificationDto(
    val id: String,
    @SerialName("customer_id") val customerId: String? = null,
    @SerialName("order_id") val orderId: String? = null,
    val type: String,
    val title: String,
    val body: String,
    @SerialName("is_read") val isRead: Boolean = false,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class NotificationListResponse(
    val notifications: List<NotificationDto> = emptyList(),
    @SerialName("unread_count") val unreadCount: Int = 0
)

@Serializable
data class MarkNotificationReadRequest(
    @SerialName("notification_id") val notificationId: String? = null,
    @SerialName("mark_all") val markAll: Boolean = false
)

@Serializable
data class FcmTokenRequest(
    @SerialName("fcm_token") val fcmToken: String,
    @SerialName("device_info") val deviceInfo: String? = null,
    @SerialName("notify_order_status") val notifyOrderStatus: Boolean = true,
    @SerialName("notify_promotions") val notifyPromotions: Boolean = true
)

@Serializable
data class NotificationPreferencesResponse(
    @SerialName("notify_order_status") val notifyOrderStatus: Boolean = true,
    @SerialName("notify_promotions") val notifyPromotions: Boolean = true
)

@Serializable
data class UpdateNotificationPreferencesRequest(
    @SerialName("notify_order_status") val notifyOrderStatus: Boolean? = null,
    @SerialName("notify_promotions") val notifyPromotions: Boolean? = null
)


@Serializable
data class ProfileResponse(
    val customer: CustomerDto
)

/** Field null = tidak diubah. `phone` string kosong = hapus nomor. */
@Serializable
data class UpdateProfileRequest(
    val name: String? = null,
    val phone: String? = null
)
