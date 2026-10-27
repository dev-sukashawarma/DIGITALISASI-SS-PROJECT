package com.sukashawarma.superapp.ui.features.pengantaran

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.superapp.utils.LocationHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Oranye = Color(0xFFF29744)
private val Coklat = Color(0xFF701604)
private val Hijau = Color(0xFF0A7D2C)
private val Krem = Color(0xFFFFF8F1)

private class ServiceAndroid(private val context: Context) : KendaliService {
    override fun mulai(pengaturan: Pengaturan, tiba: Int, total: Int) =
        PengantaranLocationService.mulai(context, pengaturan, tiba, total)
    override fun perbarui(tiba: Int, total: Int) = PengantaranLocationService.perbarui(context, tiba, total)
    override fun hentikan() = PengantaranLocationService.hentikan(context)
}

@Composable
fun PengantaranScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val vm = remember {
        val helper = LocationHelper(context)
        PengantaranViewModel(
            api = PengantaranRepository(),
            lokasi = { helper.getCurrentLocation()?.let { Posisi(it.latitude, it.longitude, if (it.hasAccuracy()) it.accuracy else null) } },
            service = ServiceAndroid(context.applicationContext),
            punyaIzinLokasi = { punyaIzinLokasi(context) },
        )
    }
    val s by vm.state.collectAsState()
    LaunchedEffect(Unit) { vm.muat() }

    Column(Modifier.fillMaxSize().background(Krem)) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹ Kembali", color = Coklat) }
            Text("Pengantaran", fontSize = 20.sp, fontWeight = FontWeight.Black, color = Coklat)
        }
        s.pesan?.let {
            Text(
                it,
                color = Color(0xFFB91C1C),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        Box(Modifier.weight(1f)) {
            when (s.layar) {
                LayarPengantaran.Memuat -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                LayarPengantaran.PerluIzin -> PanduanIzinScreen { scope.launch { vm.muat() } }
                LayarPengantaran.PilihMuatan -> PilihMuatan(s, vm::pilih, { scope.launch { vm.muat() } }) { scope.launch { vm.lanjutUrutan() } }
                LayarPengantaran.SusunUrutan -> SusunUrutan(s, vm::pindah, vm::kembaliKePilih) { scope.launch { vm.berangkat() } }
                LayarPengantaran.DalamPerjalanan -> DalamPerjalanan(
                    s,
                    onTiba = { id -> scope.launch { vm.tiba(id) } },
                    onPindah = { a, b -> scope.launch { vm.pindahBerjalan(a, b) } },
                    onSelesaikan = { scope.launch { vm.mintaSelesaikan() } },
                )
                LayarPengantaran.Ringkasan -> Ringkasan(s) { scope.launch { vm.muat() } }
            }
        }
    }

    if (s.konfirmasiSelesai) {
        val sisa = s.perjalanan?.stops?.count { it.status == "menunggu" } ?: 0
        AlertDialog(
            onDismissRequest = vm::batalSelesaikan,
            title = { Text("Selesaikan perjalanan?") },
            text = { Text("$sisa outlet belum ditandai tiba dan akan tercatat \"tidak ditandai tiba\". Lokasi berhenti dikirim.") },
            confirmButton = { TextButton(onClick = { scope.launch { vm.selesaikan() } }) { Text("Selesaikan") } },
            dismissButton = { TextButton(onClick = vm::batalSelesaikan) { Text("Batal") } },
        )
    }
}

@Composable
private fun PilihMuatan(s: PengantaranState, onPilih: (String) -> Unit, onMuatUlang: () -> Unit, onLanjut: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Pilih surat jalan yang kamu bawa", fontWeight = FontWeight.Bold, color = Coklat)
        if (s.sjSiap.isEmpty()) {
            Spacer(Modifier.padding(8.dp))
            Text("Belum ada surat jalan berstatus dikirim. Minta gudang menandai \"dikirim\" dulu.", fontSize = 13.sp)
            OutlinedButton(onClick = onMuatUlang, modifier = Modifier.padding(top = 12.dp)) { Text("Muat ulang") }
        }
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(s.sjSiap) { _, sj ->
                Card(Modifier.fillMaxWidth().clickable { onPilih(sj.suratJalanId) }) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = sj.suratJalanId in s.dipilih, onCheckedChange = { onPilih(sj.suratJalanId) })
                        Column {
                            Text(sj.outletName, fontWeight = FontWeight.Bold)
                            Text("${sj.documentNumber ?: "SJ"} · ${sj.jumlahItem} item", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
        Button(onClick = onLanjut, enabled = !s.sibuk, modifier = Modifier.fillMaxWidth()) {
            Text("Lanjut: susun urutan (${s.dipilih.size})")
        }
    }
}

@Composable
private fun SusunUrutan(s: PengantaranState, onPindah: (Int, Int) -> Unit, onKembali: () -> Unit, onBerangkat: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Urutan antar (usulan terdekat, bisa diubah)", fontWeight = FontWeight.Bold, color = Coklat)
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(s.urutan) { i, sj ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("${i + 1}.", fontWeight = FontWeight.Black, color = Oranye, modifier = Modifier.padding(end = 8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(sj.outletName, fontWeight = FontWeight.Bold)
                            Text(sj.documentNumber ?: "SJ", fontSize = 12.sp)
                        }
                        TextButton(onClick = { onPindah(i, i - 1) }, enabled = i > 0) { Text("▲") }
                        TextButton(onClick = { onPindah(i, i + 1) }, enabled = i < s.urutan.lastIndex) { Text("▼") }
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onKembali) { Text("Kembali") }
            Button(onClick = onBerangkat, enabled = !s.sibuk && s.urutan.isNotEmpty(), modifier = Modifier.weight(1f)) {
                Text(if (s.sibuk) "Memulai…" else "Berangkat")
            }
        }
    }
}

@Composable
private fun DalamPerjalanan(
    s: PengantaranState,
    onTiba: (String) -> Unit,
    onPindah: (Int, Int) -> Unit,
    onSelesaikan: () -> Unit,
) {
    val p = s.perjalanan ?: return
    val kirim by PengantaranLocationService.status.collectAsState()
    var sekarang by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(5_000); sekarang = System.currentTimeMillis() } }

    val menunggu = p.stops.filter { it.status == "menunggu" }
    val berikutnya = menunggu.firstOrNull()?.id

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Berangkat ${jamWib(p.berangkatAtIso)} · ${p.stops.size - menunggu.size}/${p.stops.size} outlet", fontWeight = FontWeight.Bold, color = Coklat)
        val banner = buildString {
            append(kirim.terakhirTerkirimMs?.let { "Terakhir terkirim ${(sekarang - it) / 1000} dtk lalu" } ?: "Menunggu titik lokasi pertama")
            if (kirim.menunggu > 0) append(" · ${kirim.menunggu} titik menunggu sinyal")
        }
        Text(banner, fontSize = 12.sp, modifier = Modifier.padding(vertical = 6.dp))

        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(p.stops) { _, st ->
                val sorot = st.id == berikutnya
                Card(
                    Modifier.fillMaxWidth().then(if (sorot) Modifier.background(Oranye.copy(alpha = 0.12f), RoundedCornerShape(12.dp)) else Modifier),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text("${st.urutan}. ${st.outletName}", fontWeight = FontWeight.Bold, color = if (sorot) Oranye else Color.Unspecified)
                        Text(st.documentNumber ?: "SJ", fontSize = 12.sp)
                        when (st.status) {
                            "menunggu" -> {
                                val idx = menunggu.indexOfFirst { it.id == st.id }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Button(onClick = { onTiba(st.id) }, enabled = !s.sibuk) { Text("Tiba") }
                                    TextButton(onClick = { onPindah(idx, idx - 1) }, enabled = idx > 0 && !s.sibuk) { Text("▲") }
                                    TextButton(onClick = { onPindah(idx, idx + 1) }, enabled = idx < menunggu.lastIndex && !s.sibuk) { Text("▼") }
                                }
                            }
                            "tiba" -> Text(
                                "✓ Tiba ${st.tibaAtIso?.let(::jamWib) ?: ""}" +
                                    if (st.tibaSumber == "verifikasi_outlet") " (dari verifikasi outlet)"
                                    else st.tibaJarakM?.let { " · ${formatJarak(it)}" } ?: "",
                                color = Hijau,
                                fontSize = 13.sp,
                            )
                            "tidak_ditandai" -> Text("✗ Tidak ditandai tiba", fontSize = 13.sp)
                            "dibatalkan" -> Text("— Surat jalan dibatalkan", fontSize = 13.sp)
                        }
                    }
                }
            }
        }
        OutlinedButton(onClick = onSelesaikan, enabled = !s.sibuk, modifier = Modifier.fillMaxWidth()) {
            Text("Selesaikan Perjalanan")
        }
    }
}

@Composable
private fun Ringkasan(s: PengantaranState, onLagi: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("Perjalanan selesai", fontSize = 22.sp, fontWeight = FontWeight.Black, color = Coklat)
        s.ringkasan?.let { r ->
            val km = r.totalKm?.let { String.format(java.util.Locale.US, "%.1f km", it).replace('.', ',') }
            val durasi = r.durasiDetik?.let { "${it / 3600} jam ${(it % 3600) / 60} mnt" }
            Text(listOfNotNull(km, durasi).joinToString(" · "), modifier = Modifier.padding(top = 8.dp))
        }
        Text("Lokasi sudah berhenti dikirim.", fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        Button(onClick = onLagi, modifier = Modifier.padding(top = 24.dp)) { Text("Perjalanan baru") }
    }
}
