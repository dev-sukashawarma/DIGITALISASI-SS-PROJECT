package com.sukashawarma.customer.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sukashawarma.customer.data.NotificationStore
import com.sukashawarma.customer.data.Repository
import com.sukashawarma.customer.data.api.GatewayError
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.NotificationDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class KategoriNotifikasi(val label: String) {
    SEMUA("Semua"),
    PESANAN("Pesanan"),
    PROMO("Promo & Info")
}

data class NotificationState(
    val memuat: Boolean = true,
    val galat: GatewayError? = null,
    val semuaNotifikasi: List<NotificationDto> = emptyList(),
    val unreadCount: Int = 0,
    val tabTerpilih: KategoriNotifikasi = KategoriNotifikasi.SEMUA,
    val sedangMemproses: Boolean = false
) {
    val notifikasiTampil: List<NotificationDto>
        get() = when (tabTerpilih) {
            KategoriNotifikasi.SEMUA -> semuaNotifikasi
            KategoriNotifikasi.PESANAN -> semuaNotifikasi.filter {
                it.type == "order_status" || it.type == "reminder"
            }
            KategoriNotifikasi.PROMO -> semuaNotifikasi.filter {
                it.type == "promo" || it.type == "system"
            }
        }
}

class NotificationViewModel(
    private val repository: Repository,
    private val notificationStore: NotificationStore
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationState())
    val state: StateFlow<NotificationState> = _state.asStateFlow()

    init {
        muat()
    }

    fun muat() {
        viewModelScope.launch {
            _state.value = _state.value.copy(memuat = true, galat = null)
            when (val hasil = repository.ambilNotifikasi()) {
                is GatewayResult.Sukses -> {
                    val notifs = hasil.data.notifications
                    val unread = hasil.data.unreadCount
                    notificationStore.setUnreadCount(unread)
                    _state.value = _state.value.copy(
                        memuat = false,
                        semuaNotifikasi = notifs,
                        unreadCount = unread,
                        galat = null
                    )
                }
                is GatewayResult.Gagal -> {
                    _state.value = _state.value.copy(
                        memuat = false,
                        galat = hasil.error
                    )
                }
            }
        }
    }

    fun gantiTab(tab: KategoriNotifikasi) {
        _state.value = _state.value.copy(tabTerpilih = tab)
    }

    fun tandaiDibaca(id: String) {
        viewModelScope.launch {
            val listLama = _state.value.semuaNotifikasi
            val target = listLama.find { it.id == id } ?: return@launch
            if (target.isRead) return@launch

            // Optimistic update
            val listBaru = listLama.map { if (it.id == id) it.copy(isRead = true) else it }
            val unreadBaru = (_state.value.unreadCount - 1).coerceAtLeast(0)
            notificationStore.setUnreadCount(unreadBaru)
            _state.value = _state.value.copy(
                semuaNotifikasi = listBaru,
                unreadCount = unreadBaru
            )

            repository.tandaiNotifikasiDibaca(notificationId = id)
        }
    }

    fun tandaiSemuaDibaca() {
        viewModelScope.launch {
            if (_state.value.unreadCount == 0) return@launch
            _state.value = _state.value.copy(sedangMemproses = true)

            // Optimistic update
            val listBaru = _state.value.semuaNotifikasi.map { it.copy(isRead = true) }
            notificationStore.setUnreadCount(0)
            _state.value = _state.value.copy(
                semuaNotifikasi = listBaru,
                unreadCount = 0,
                sedangMemproses = false
            )

            repository.tandaiNotifikasiDibaca(tandaiSemua = true)
        }
    }
}
