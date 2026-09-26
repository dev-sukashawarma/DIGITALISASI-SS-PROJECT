package com.sukashawarma.customer.ui.voucher

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.VoucherDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted

/**
 * Layar Voucher -- dibuka dari Beranda ("Voucher untukmu") maupun Profil
 * ("Voucher Saya"). Memakai daftar keranjang-agnostik dari `Repository.vouchers()`
 * tanpa `outletId`/`items` -- lihat semua voucher, bukan hanya yang cocok
 * dengan isi keranjang saat ini (itu tugas `PemilihVoucherSheet` di checkout).
 */
@Composable
fun VoucherScreen(
    viewModel: VoucherViewModel,
    onKembali: () -> Unit,
    onSetelahPakai: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            PageBrandHeader(
                judul = "Voucher",
                subjudul = "Promo yang bisa kamu pakai",
                onKembali = onKembali
            )
        }
    ) { padding ->
        when {
            state.memuat -> {
                Box(
                    modifier = Modifier.padding(padding).fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    MemuatState()
                }
            }

            state.galat != null -> {
                Box(
                    modifier = Modifier.padding(padding).fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    ErrorState(
                        error = state.galat!!,
                        onCobaLagi = viewModel::muatUlang
                    )
                }
            }

            state.vouchers.isEmpty() -> {
                Box(
                    modifier = Modifier.padding(padding).fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    EmptyState(
                        judul = "Belum ada voucher",
                        penjelasan = "Voucher baru akan muncul di sini."
                    )
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.padding(padding).fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(state.vouchers, key = { it.id }) { v ->
                        KartuVoucher(
                            voucher = v,
                            onPakai = {
                                viewModel.pakai(v)
                                onSetelahPakai()
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun KartuVoucher(voucher: VoucherDto, onPakai: () -> Unit) {
    val bolehDipakai = voucher.status == "berlaku"

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = if (bolehDipakai) SukaGreen.copy(alpha = 0.06f) else androidx.compose.ui.graphics.Color.White,
        border = BorderStroke(1.dp, if (bolehDipakai) SukaGreen.copy(alpha = 0.4f) else SukaBorder)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = voucher.nama,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = SukaInk,
                    fontSize = 15.sp
                )
            )
            Text(
                text = voucher.kalimatSyarat,
                style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 12.sp)
            )
            voucher.deskripsi?.let { deskripsi ->
                Text(
                    text = deskripsi,
                    style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 12.sp)
                )
            }

            if (!bolehDipakai && voucher.alasan != null) {
                Spacer(modifier = Modifier.width(1.dp))
                Text(
                    text = voucher.alasan,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = SukaMuted,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp
                    )
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.End
            ) {
                Button(
                    onClick = onPakai,
                    enabled = bolehDipakai,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SukaGreen,
                        contentColor = androidx.compose.ui.graphics.Color.White,
                        disabledContainerColor = SukaBorder,
                        disabledContentColor = SukaMuted
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Pakai", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
