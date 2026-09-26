package com.sukashawarma.customer.ui.voucher

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.data.api.VoucherDto
import com.sukashawarma.customer.ui.theme.SukaBody
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

private val LEBAR_POTONGAN = 92.dp
private val JARI_LEKUK = 8.dp
private val WarnaPudar = Color(0xFFB4A79C)

/**
 * Kartu voucher bergaya tiket kupon: potongan kiri berwarna berisi nilai
 * (Rp5rb, 20%, Gratis), sobekan putus-putus, lalu nama, syarat, masa
 * berlaku, dan tombol Pakai. Dipakai halaman Voucher dan pemilih voucher di
 * checkout supaya keduanya seragam.
 */
@Composable
fun KartuVoucher(
    voucher: VoucherDto,
    onPakai: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bolehDipakai = voucher.status == "berlaku"
    val (nilai, sub) = nilaiKartu(voucher)
    val berlakuSampai = labelBerlakuSampai(voucher.selesai)
    val syarat = syaratTanpaTanggal(voucher.kalimatSyarat, berlakuSampai)
    val (latarPotongan, teksPotongan) = when (warnaKartu(voucher)) {
        WarnaKartu.ORANYE -> SukaOrange to SukaInk
        WarnaKartu.COKELAT -> SukaBrown to Color.White
        WarnaKartu.HIJAU -> SukaGreen to Color.White
        WarnaKartu.PUDAR -> WarnaPudar to Color.White
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (bolehDipakai) 1f else 0.65f),
        shape = BentukTiket(LEBAR_POTONGAN, JARI_LEKUK, 16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, SukaBorder)
    ) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            Column(
                modifier = Modifier
                    .width(LEBAR_POTONGAN)
                    .fillMaxHeight()
                    .background(latarPotongan)
                    .padding(horizontal = 6.dp, vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = nilai,
                    color = teksPotongan,
                    fontSize = if (nilai.length > 6) 18.sp else 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    maxLines = 1
                )
                if (sub.isNotBlank()) {
                    Text(
                        text = sub,
                        color = teksPotongan.copy(alpha = 0.9f),
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            GarisSobek()

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 12.dp, end = 14.dp, top = 12.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = voucher.nama,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = SukaInk,
                        fontSize = 15.sp
                    ),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (syarat.isNotBlank()) {
                    Text(
                        text = syarat,
                        style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 12.sp),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                voucher.deskripsi?.takeIf { it.isNotBlank() }?.let { deskripsi ->
                    Text(
                        text = deskripsi,
                        style = MaterialTheme.typography.bodySmall.copy(color = SukaBody, fontSize = 12.sp),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (berlakuSampai != null) {
                            Icon(
                                imageVector = Icons.Filled.Schedule,
                                contentDescription = null,
                                tint = SukaMuted,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(berlakuSampai, color = SukaMuted, fontSize = 11.sp, maxLines = 1)
                        }
                    }

                    if (bolehDipakai) {
                        Button(
                            onClick = onPakai,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SukaOrange,
                                contentColor = SukaInk
                            ),
                            shape = CircleShape,
                            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 6.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Text("Pakai", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }

                if (!bolehDipakai && voucher.alasan != null) {
                    Surface(
                        shape = CircleShape,
                        color = SukaTint,
                        modifier = Modifier.padding(top = 2.dp)
                    ) {
                        Text(
                            text = voucher.alasan,
                            color = SukaBody,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

/** Garis putus-putus di antara potongan kiri dan isi kartu. */
@Composable
private fun GarisSobek() {
    Canvas(
        modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .padding(vertical = 12.dp)
    ) {
        drawLine(
            color = SukaBorder,
            start = Offset(0f, 0f),
            end = Offset(0f, size.height),
            strokeWidth = 1.5.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx()))
        )
    }
}

/**
 * Persegi panjang bersudut bulat dengan dua lekukan setengah lingkaran di
 * tepi atas dan bawah, tepat di garis sobek -- kesan tiket yang bisa dirobek.
 */
private class BentukTiket(
    private val posisiLekuk: Dp,
    private val jariLekuk: Dp,
    private val sudut: Dp
) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val x = with(density) { posisiLekuk.toPx() }
        val r = with(density) { jariLekuk.toPx() }
        val c = with(density) { sudut.toPx() }
        val dasar = Path().apply {
            addRoundRect(RoundRect(0f, 0f, size.width, size.height, CornerRadius(c)))
        }
        val lekuk = Path().apply {
            addOval(Rect(center = Offset(x, 0f), radius = r))
            addOval(Rect(center = Offset(x, size.height), radius = r))
        }
        return Outline.Generic(Path.combine(PathOperation.Difference, dasar, lekuk))
    }
}
