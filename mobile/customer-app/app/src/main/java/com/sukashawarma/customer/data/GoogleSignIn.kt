package com.sukashawarma.customer.data

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Hasil pengambilan ID token dari Google.
 *
 * Dibatalkan dipisahkan dari Gagal karena keduanya menuntut perlakuan yang
 * berbeda: pelanggan yang menutup lembar akun sendiri tidak boleh disuguhi
 * pesan galat merah seolah ada yang rusak.
 */
sealed class HasilIdToken {
    data class Sukses(val idToken: String) : HasilIdToken()
    object Dibatalkan : HasilIdToken()
    object TidakAdaAkun : HasilIdToken()
    data class Gagal(val sebab: Throwable) : HasilIdToken()
}

/**
 * Mengambil ID token Google lewat **Credential Manager**.
 *
 * Bukan `GoogleSignInClient` (sudah usang) dan bukan alur redirect browser:
 * lembar akun muncul DI DALAM aplikasi, pelanggan menekan sekali, aplikasi
 * menerima ID token.
 *
 * Token ini tidak dipakai aplikasi untuk apa pun selain ditukar ke gateway.
 * Aplikasi tidak pernah berbicara ke Supabase.
 *
 * `serverClientId` HARUS Web client ID dari project Google Cloud yang sama
 * dengan provider Google di Supabase. Android client ID di posisi ini
 * menghasilkan penolakan 401 yang pesannya tidak menunjuk penyebabnya sama
 * sekali -- periksa ini lebih dulu sebelum menduga hal lain.
 *
 * **Nonce sengaja tidak disetel.** Kalau suatu saat `setNonce()` ditambahkan
 * di sini, gateway WAJIB meneruskan nonce yang sama ke `signInWithIdToken`,
 * atau "Skip nonce checks" harus dinyalakan di Supabase. Tanpa itu, login
 * rusak total dan galatnya tidak menjelaskan apa-apa.
 *
 * @param context harus context **Activity**, bukan application context --
 *   Credential Manager perlu menempelkan lembar akun ke jendela yang sedang
 *   tampil.
 */
suspend fun ambilIdTokenGoogle(context: Context, serverClientId: String): HasilIdToken {
    val opsi = GetGoogleIdOption.Builder()
        .setServerClientId(serverClientId)
        // `false` supaya pelanggan baru -- yang belum pernah memberi izin ke
        // aplikasi ini -- tetap melihat daftar akunnya. `true` akan menyuguhi
        // mereka daftar kosong dan jalan buntu tanpa penjelasan.
        .setFilterByAuthorizedAccounts(false)
        .setAutoSelectEnabled(true)
        .build()

    val permintaan = GetCredentialRequest.Builder().addCredentialOption(opsi).build()

    return try {
        val hasil = CredentialManager.create(context).getCredential(context, permintaan)
        val kredensial = GoogleIdTokenCredential.createFrom(hasil.credential.data)
        HasilIdToken.Sukses(kredensial.idToken)
    } catch (e: GetCredentialCancellationException) {
        HasilIdToken.Dibatalkan
    } catch (e: NoCredentialException) {
        HasilIdToken.TidakAdaAkun
    } catch (e: Exception) {
        HasilIdToken.Gagal(e)
    }
}
