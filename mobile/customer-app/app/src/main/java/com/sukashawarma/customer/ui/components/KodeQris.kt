package com.sukashawarma.customer.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/** Sisi bitmap QR dalam piksel. */
private const val UKURAN_PX = 720

/**
 * Menggambar bitmap QRIS dari teks mentahnya.
 *
 * **Selalu hitam-putih murni, tanpa gaya.** Godaan untuk mewarnai atau
 * menempelkan logo di tengah harus ditolak: pemindai QRIS di aplikasi bank
 * bervariasi mutunya, dan kode yang gagal dipindai di kasir jauh lebih mahal
 * daripada kode yang terlihat polos.
 *
 * Tingkat koreksi galat **M**, bukan H. QRIS dinamis memuat cukup banyak data;
 * koreksi galat yang lebih tinggi memperbanyak modul, memperkecil tiap kotak,
 * dan justru mempersulit pemindaian di layar ponsel kecil.
 *
 * Mengembalikan null bila teksnya tidak bisa disandikan -- pemanggil WAJIB
 * menyediakan jalan lain, jangan menampilkan kotak kosong.
 */
fun gambarQris(isi: String): Bitmap? = runCatching {
    val matriks = QRCodeWriter().encode(
        isi,
        BarcodeFormat.QR_CODE,
        UKURAN_PX,
        UKURAN_PX,
        mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 1,
            EncodeHintType.CHARACTER_SET to "UTF-8"
        )
    )

    val lebar = matriks.width
    val tinggi = matriks.height
    val piksel = IntArray(lebar * tinggi)
    for (y in 0 until tinggi) {
        val baris = y * lebar
        for (x in 0 until lebar) {
            piksel[baris + x] = if (matriks[x, y]) HITAM else PUTIH
        }
    }

    Bitmap.createBitmap(lebar, tinggi, Bitmap.Config.ARGB_8888).apply {
        setPixels(piksel, 0, lebar, 0, 0, lebar, tinggi)
    }
}.getOrNull()

private const val HITAM = 0xFF000000.toInt()
private const val PUTIH = 0xFFFFFFFF.toInt()

/**
 * Kartu QRIS siap pindai.
 *
 * Latar putih dipaksa, tidak mengikuti tema. Kode QR di atas latar krem masih
 * terbaca oleh sebagian pemindai dan gagal di sebagian lain -- dan yang gagal
 * itu terjadi di depan kasir, saat pelanggan sudah mengantre.
 */
@Composable
fun KartuQris(
    qrString: String,
    modifier: Modifier = Modifier
) {
    val bitmap = remember(qrString) { gambarQris(qrString) }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = androidx.compose.ui.graphics.Color.White
    ) {
        Box(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "Kode QRIS untuk pembayaran",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().aspectRatio(1f)
                )
            } else {
                Text(
                    "Kode QR gagal digambar. Pakai tombol di bawah untuk membuka " +
                        "halaman pembayaran.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = androidx.compose.ui.graphics.Color.Black,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
