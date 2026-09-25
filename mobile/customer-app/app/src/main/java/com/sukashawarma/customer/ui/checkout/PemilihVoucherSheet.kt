package com.sukashawarma.customer.ui.checkout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.api.VoucherDto
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange

/**
 * Lembar pemilihan voucher yang dibuka dari layar Ringkasan Pesanan.
 *
 * `muatDaftar` dipanggil sekali saat lembar dibuka -- bukan tiap kali
 * pelanggan menggulir -- supaya daftar tidak berubah urutan/isi di tengah
 * pelanggan sedang membaca syaratnya.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PemilihVoucherSheet(
    muatDaftar: suspend () -> GatewayResult<List<VoucherDto>>,
    onPilih: (PilihanVoucher) -> Unit,
    onTutup: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var hasil by remember { mutableStateOf<GatewayResult<List<VoucherDto>>?>(null) }
    var kode by remember { mutableStateOf("") }
    var percobaan by remember { mutableStateOf(0) }

    LaunchedEffect(percobaan) {
        hasil = null
        hasil = muatDaftar()
    }

    ModalBottomSheet(
        onDismissRequest = onTutup,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .navigationBarsPadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Pilih Voucher",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = SukaInk
                )
            )

            when (val h = hasil) {
                null -> MemuatState()
                is GatewayResult.Gagal -> ErrorState(
                    error = h.error,
                    onCobaLagi = { percobaan++ }
                )
                is GatewayResult.Sukses -> {
                    if (h.data.isEmpty()) {
                        Text(
                            text = "Belum ada voucher untuk keranjang ini.",
                            style = MaterialTheme.typography.bodyMedium.copy(color = SukaMuted)
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(h.data, key = { it.id }) { v ->
                                KartuVoucher(
                                    voucher = v,
                                    onPilih = {
                                        onPilih(PilihanVoucher(id = v.id, nama = v.nama))
                                    }
                                )
                            }
                        }
                    }
                }
            }

            Text(
                text = "Punya kode?",
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = SukaInk
                )
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = kode,
                    onValueChange = { kode = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("Masukkan kode voucher", color = SukaMuted) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = SukaOrange,
                        unfocusedBorderColor = SukaBorder,
                        focusedTextColor = SukaInk,
                        unfocusedTextColor = SukaInk,
                        cursorColor = SukaBrown
                    )
                )
                Button(
                    onClick = {
                        val kodeBersih = kode.trim().uppercase()
                        onPilih(PilihanVoucher(kode = kodeBersih, nama = kodeBersih))
                    },
                    enabled = kode.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SukaOrange,
                        contentColor = SukaInk
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Pakai", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun KartuVoucher(voucher: VoucherDto, onPilih: () -> Unit) {
    val bolehDipakai = voucher.status == "berlaku"

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (bolehDipakai) 1f else 0.5f)
            .let { if (bolehDipakai) it.clickable(onClick = onPilih) else it },
        shape = RoundedCornerShape(14.dp),
        color = if (bolehDipakai) SukaGreen.copy(alpha = 0.06f) else MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, if (bolehDipakai) SukaGreen.copy(alpha = 0.4f) else SukaBorder)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = voucher.nama,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = SukaInk,
                    fontSize = 14.sp
                )
            )
            Text(
                text = voucher.kalimatSyarat,
                style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 12.sp)
            )
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
        }
    }
}
