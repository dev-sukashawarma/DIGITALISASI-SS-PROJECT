package com.sukashawarma.customer.ui.screens.login

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.BuildConfig
import com.sukashawarma.customer.data.HasilIdToken
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.SessionStore
import com.sukashawarma.customer.data.ambilIdTokenGoogle
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.ui.components.pesanGalat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LoginState(
    val memuat: Boolean = false,
    val pesanGalat: String? = null,
    val berhasil: Boolean = false
)

class LoginViewModel(
    private val repository: Repository,
    private val sessionStore: SessionStore
) : ViewModel() {

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()

    /**
     * @param context harus context Activity -- Credential Manager perlu
     *   menempelkan lembar akun ke jendela yang sedang tampil.
     */
    fun masukDenganGoogle(context: Context) {
        _state.value = LoginState(memuat = true)

        viewModelScope.launch {
            when (val token = ambilIdTokenGoogle(context, BuildConfig.GOOGLE_WEB_CLIENT_ID)) {
                // Pelanggan menutup lembar akun sendiri. Bukan galat, jadi
                // tidak ada pesan merah -- layar hanya kembali seperti semula.
                HasilIdToken.Dibatalkan ->
                    _state.value = LoginState()

                HasilIdToken.TidakAdaAkun ->
                    _state.value = LoginState(
                        pesanGalat = "Belum ada akun Google di perangkat ini. " +
                            "Tambahkan akun Google lewat Setelan, lalu coba lagi."
                    )

                is HasilIdToken.Gagal ->
                    _state.value = LoginState(
                        pesanGalat = "Gagal membuka akun Google. Coba lagi sebentar lagi."
                    )

                is HasilIdToken.Sukses -> tukarKeGateway(token.idToken)
            }
        }
    }

    private suspend fun tukarKeGateway(idToken: String) {
        when (val hasil = repository.loginGoogle(idToken)) {
            is GatewayResult.Gagal -> {
                // 401 di SINI bukan "sesi berakhir" -- belum ada sesi sama
                // sekali. Artinya gateway menolak ID token-nya. Memakai pesan
                // umum `pesanGalat` akan menyuruh pelanggan "masuk lagi" dari
                // dalam layar masuk itu sendiri.
                val pesan = if (hasil.error is GatewayError.SesiTidakSah) {
                    "Google menolak masuk. Coba lagi, atau pakai akun Google lain."
                } else {
                    pesanGalat(hasil.error)
                }
                _state.value = LoginState(pesanGalat = pesan)
            }

            is GatewayResult.Sukses -> {
                val auth = hasil.data
                sessionStore.simpan(
                    token = auth.token,
                    expiresAt = auth.expiresAt,
                    nama = auth.customer.name
                )
                _state.value = LoginState(berhasil = true)
            }
        }
    }

    fun bersihkanGalat() {
        _state.value = _state.value.copy(pesanGalat = null)
    }
}
