package com.sukashawarma.customer.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.SessionStore
import com.sukashawarma.customer.data.api.CustomerDto
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.ui.components.pesanGalat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InformasiAkunState(
    val nama: String = "",
    val email: String? = null,
    val whatsApp: String = "",
    /** Nilai terakhir yang tersimpan di server, untuk tahu ada perubahan atau tidak. */
    val namaTersimpan: String = "",
    val whatsAppTersimpan: String = "",
    val galatNama: String? = null,
    val galatWhatsApp: String? = null,
    val menyimpan: Boolean = false,
    val pesanGalat: String? = null,
    val tersimpan: Boolean = false,
) {
    val adaPerubahan: Boolean
        get() = ProfilForm.rapikanNama(nama) != namaTersimpan ||
            whatsApp.trim() != whatsAppTersimpan
}

class InformasiAkunViewModel(
    private val repository: Repository,
    private val sessionStore: SessionStore,
) : ViewModel() {

    private val _state = MutableStateFlow(dariSesi())
    val state: StateFlow<InformasiAkunState> = _state.asStateFlow()

    init {
        // Sesi lokal bisa basi (nomor diisi saat pesan, nama diubah di HP lain).
        // Segarkan diam-diam; kalau gagal, isian dari sesi tetap dipakai.
        viewModelScope.launch {
            val hasil = repository.profil()
            if (hasil is GatewayResult.Sukses) terapkanDariServer(hasil.data, tandaiTersimpan = false)
        }
    }

    private fun dariSesi(): InformasiAkunState {
        val sesi = sessionStore.baca()
        val nama = sesi?.nama?.trim().orEmpty()
        val wa = ProfilForm.untukIsian(sesi?.telepon)
        return InformasiAkunState(
            nama = nama,
            email = sesi?.email,
            whatsApp = wa,
            namaTersimpan = nama,
            whatsAppTersimpan = wa,
        )
    }

    fun ubahNama(nilai: String) = _state.update {
        it.copy(nama = nilai, galatNama = null, pesanGalat = null, tersimpan = false)
    }

    fun ubahWhatsApp(nilai: String) = _state.update {
        it.copy(whatsApp = nilai, galatWhatsApp = null, pesanGalat = null, tersimpan = false)
    }

    fun simpan() {
        val s = _state.value
        if (s.menyimpan || !s.adaPerubahan) return

        val galatNama = ProfilForm.galatNama(s.nama)
        val galatWa = ProfilForm.galatWhatsApp(s.whatsApp)
        if (galatNama != null || galatWa != null) {
            _state.update { it.copy(galatNama = galatNama, galatWhatsApp = galatWa) }
            return
        }

        val namaBaru = ProfilForm.rapikanNama(s.nama)
        val waBaru = s.whatsApp.trim()
        // Kirim hanya yang berubah: field null tidak disentuh gateway.
        val kirimNama = namaBaru.takeIf { it != s.namaTersimpan }
        val kirimWa = waBaru.takeIf { it != s.whatsAppTersimpan }

        _state.update { it.copy(menyimpan = true, pesanGalat = null, tersimpan = false) }
        viewModelScope.launch {
            when (val hasil = repository.simpanProfil(kirimNama, kirimWa)) {
                is GatewayResult.Sukses -> terapkanDariServer(hasil.data, tandaiTersimpan = true)
                is GatewayResult.Gagal -> _state.update {
                    it.copy(menyimpan = false, pesanGalat = pesanGalat(hasil.error))
                }
            }
        }
    }

    private fun terapkanDariServer(c: CustomerDto, tandaiTersimpan: Boolean) {
        val sesi = sessionStore.baca() ?: return
        sessionStore.simpan(
            token = sesi.token,
            expiresAt = sesi.expiresAt,
            nama = c.name,
            email = c.email ?: sesi.email,
            telepon = c.phone,
        )
        val nama = c.name?.trim().orEmpty()
        val wa = ProfilForm.untukIsian(c.phone)
        _state.update { lama ->
            // Penyegaran awal tak boleh menimpa yang sedang diketik pelanggan.
            val sedangMengetik = !tandaiTersimpan && lama.adaPerubahan
            lama.copy(
                nama = if (sedangMengetik) lama.nama else nama,
                whatsApp = if (sedangMengetik) lama.whatsApp else wa,
                email = c.email ?: lama.email,
                namaTersimpan = nama,
                whatsAppTersimpan = wa,
                menyimpan = false,
                tersimpan = tandaiTersimpan,
            )
        }
    }
}
