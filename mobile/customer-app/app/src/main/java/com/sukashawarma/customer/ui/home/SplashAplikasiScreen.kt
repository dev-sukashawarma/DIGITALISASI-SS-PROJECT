package com.sukashawarma.customer.ui.home

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.sukashawarma.customer.R
import com.sukashawarma.customer.ui.theme.SukaBrown
import kotlinx.coroutines.delay
import java.io.File

/** Paling lama menunggu splash sistem hilang sebelum hitungan durasi tetap dimulai. */
const val BATAS_TUNGGU_SPLASH_SISTEM_MS = 3_000L

/**
 * Splash aplikasi: gambar penuh yang bisa diganti dari admin dashboard.
 *
 * Ditampilkan sebagai LAPISAN di atas seluruh aplikasi (MainActivity), bukan
 * sebagai tujuan navigasi. Navigasi tetap berawal di Beranda/perkenalan, jadi
 * `findStartDestination()` yang dipakai perpindahan tab tidak menunjuk ke layar
 * yang sudah dibuang, dan Beranda sudah mulai dimuat di belakang splash.
 *
 * Splash SISTEM hanya muncul sekejap dan tidak lagi ditahan; layar inilah yang
 * memegang durasi. Sistem Android menggambar splash-nya dari
 * resource di APK sebelum kode aplikasi jalan, jadi gambar dari admin hanya
 * bisa tampil di sini.
 *
 * [berkasGambar] null atau rusak -> gambar bawaan `splash_bawaan` di APK.
 * Tidak ada tombol lewati: ini splash, dan durasinya diatur admin (1-5 detik).
 */
@Composable
fun SplashAplikasiScreen(
    berkasGambar: File?,
    durasiMs: Long,
    splashSistemHilang: Boolean,
    onSelesai: () -> Unit,
) {
    val selesaiTerkini by rememberUpdatedState(onSelesai)

    // Hitungan durasi dimulai saat splash SISTEM benar-benar hilang, bukan
    // saat komposisi. Diukur di Galaxy A07: komposisi terjadi +0,5 detik,
    // tapi splash sistem baru hilang sekitar +2 detik. Menghitung sejak
    // komposisi membuat gambar admin berdurasi 3 detik hanya terlihat ~1,5.
    //
    // Batas tunggu: kalau sinyal hilangnya splash sistem tak pernah datang
    // (mis. Activity dibuat ulang saat memutar layar, splash sistem tak
    // tampil lagi), hitungan tetap dimulai. Tanpa ini aplikasi macet di splash.
    var mulaiHitung by remember { mutableStateOf(false) }
    LaunchedEffect(splashSistemHilang) {
        if (splashSistemHilang) mulaiHitung = true
    }
    LaunchedEffect(Unit) {
        delay(BATAS_TUNGGU_SPLASH_SISTEM_MS)
        mulaiHitung = true
    }

    // Didekode sekali, sinkron. Berkasnya sudah dikecilkan admin saat unggah
    // (ratusan KB), jadi cepat; memuatnya asinkron justru membuat gambar
    // bawaan sempat berkedip sebelum digantikan.
    val gambar: ImageBitmap? = remember(berkasGambar) {
        berkasGambar?.let { f ->
            runCatching { BitmapFactory.decodeFile(f.absolutePath)?.asImageBitmap() }.getOrNull()
        }
    }

    LaunchedEffect(mulaiHitung) {
        if (!mulaiHitung) return@LaunchedEffect
        delay(durasiMs)
        selesaiTerkini()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SukaBrown)
            .semantics { contentDescription = "Suka Shawarma" },
    ) {
        if (gambar != null) {
            Image(
                bitmap = gambar,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Image(
                painter = painterResource(R.drawable.splash_bawaan),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
