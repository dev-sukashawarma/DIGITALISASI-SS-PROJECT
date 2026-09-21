package com.sukashawarma.customer.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaButtonShape
import com.sukashawarma.customer.ui.theme.SukaInputShape
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Halaman Informasi Akun: Nama, Email, No WhatsApp.
 *
 * Nama & No WhatsApp bisa diubah. Email terkunci -- itu identitas akun Google
 * yang dipakai untuk masuk. Nama yang diubah di sini TIDAK ditimpa Google saat
 * masuk berikutnya (gateway hanya mengisi nama yang masih kosong).
 */
@Composable
fun InformasiAkunScreen(
    viewModel: InformasiAkunViewModel,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsState()
    val fokus = LocalFocusManager.current
    val inisial = remember(state.namaTersimpan) { InformasiAkun.inisial(state.namaTersimpan) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Informasi Akun",
                subjudul = "Data akun pelangganmu",
                onKembali = onKembali,
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Avatar
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(SukaOrange),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = inisial,
                        style = MaterialTheme.typography.headlineSmall.copy(
                            fontFamily = LilitaOne,
                            color = SukaInk,
                            fontSize = 28.sp,
                        ),
                    )
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Isian(
                        label = "Nama",
                        ikon = Icons.Filled.Person,
                        nilai = state.nama,
                        onUbah = viewModel::ubahNama,
                        galat = state.galatNama,
                        placeholder = "Nama lengkapmu",
                        keyboard = KeyboardOptions(
                            capitalization = KeyboardCapitalization.Words,
                            imeAction = ImeAction.Next,
                        ),
                    )

                    EmailTerkunci(state.email)

                    Isian(
                        label = "No WhatsApp",
                        ikon = Icons.Filled.Phone,
                        nilai = state.whatsApp,
                        onUbah = viewModel::ubahWhatsApp,
                        galat = state.galatWhatsApp,
                        placeholder = "0812 3456 7890",
                        keterangan = "Dipakai outlet untuk menghubungimu soal pesanan.",
                        keyboard = KeyboardOptions(
                            keyboardType = KeyboardType.Phone,
                            imeAction = ImeAction.Done,
                        ),
                        aksiKeyboard = KeyboardActions(onDone = {
                            fokus.clearFocus()
                            viewModel.simpan()
                        }),
                    )
                }
            }

            state.pesanGalat?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.error, fontSize = 13.sp),
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }

            if (state.tersimpan && !state.adaPerubahan) {
                Row(
                    modifier = Modifier.padding(horizontal = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = SukaGreen, modifier = Modifier.size(16.dp))
                    Text(
                        text = "Perubahan tersimpan.",
                        style = MaterialTheme.typography.bodySmall.copy(color = SukaGreen, fontSize = 13.sp),
                    )
                }
            }

            Button(
                onClick = {
                    fokus.clearFocus()
                    viewModel.simpan()
                },
                enabled = state.adaPerubahan && !state.menyimpan,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = SukaButtonShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = SukaOrange,
                    contentColor = SukaInk,
                    disabledContainerColor = SukaTint,
                    disabledContentColor = SukaMuted,
                ),
            ) {
                if (state.menyimpan) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = SukaInk,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Simpan", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun Isian(
    label: String,
    ikon: ImageVector,
    nilai: String,
    onUbah: (String) -> Unit,
    galat: String?,
    placeholder: String,
    keyboard: KeyboardOptions,
    keterangan: String? = null,
    aksiKeyboard: KeyboardActions = KeyboardActions.Default,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        LabelIsian(label)
        OutlinedTextField(
            value = nilai,
            onValueChange = onUbah,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            isError = galat != null,
            placeholder = { Text(placeholder, color = SukaMuted) },
            leadingIcon = { Icon(ikon, contentDescription = null, tint = SukaBrown, modifier = Modifier.size(20.dp)) },
            keyboardOptions = keyboard,
            keyboardActions = aksiKeyboard,
            shape = SukaInputShape,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = SukaOrange,
                unfocusedBorderColor = SukaBorder,
                focusedTextColor = SukaInk,
                unfocusedTextColor = SukaInk,
                cursorColor = SukaBrown,
            ),
        )
        val bawah = galat ?: keterangan
        if (bawah != null) {
            Text(
                text = bawah,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = if (galat != null) MaterialTheme.colorScheme.error else SukaMuted,
                    fontSize = 12.sp,
                ),
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
    }
}

@Composable
private fun EmailTerkunci(email: String?) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        LabelIsian("Email")
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = SukaInputShape,
            color = SukaTint,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Email, contentDescription = null, tint = SukaBrown, modifier = Modifier.size(20.dp))
                Text(
                    text = email ?: "—",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium.copy(color = SukaInk, fontSize = 15.sp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Icon(Icons.Filled.Lock, contentDescription = "Tidak bisa diubah", tint = SukaMuted, modifier = Modifier.size(16.dp))
            }
        }
        Text(
            text = "Email akun Google yang dipakai untuk masuk, tidak bisa diubah.",
            style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 12.sp),
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

@Composable
private fun LabelIsian(teks: String) {
    Text(
        text = teks,
        style = MaterialTheme.typography.labelMedium.copy(
            color = SukaBrown,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
        ),
        modifier = Modifier.padding(horizontal = 4.dp),
    )
}
