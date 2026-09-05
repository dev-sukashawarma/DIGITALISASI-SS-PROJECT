package com.sukashawarma.customer.ui.screens.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Layar 1 - perkenalan.
 *
 * "Lihat menu dulu" benar-benar bekerja: katalog terbuka penuh tanpa login.
 * Login baru diminta di titik bayar. Memaksa daftar sebelum pelanggan tahu
 * ada menu apa adalah cara tercepat kehilangan mereka.
 */
@Composable
fun OnboardingScreen(
    onMasuk: () -> Unit,
    onLihatMenu: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
        ) {
            Text(
                "Suka Shawarma",
                style = MaterialTheme.typography.headlineLarge,
                textAlign = TextAlign.Center
            )
            Text(
                "Pesan dari HP, ambil sendiri di outlet tanpa antre.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Button(onClick = onMasuk, modifier = Modifier.fillMaxWidth()) {
                Text("Masuk")
            }
            TextButton(onClick = onLihatMenu, modifier = Modifier.fillMaxWidth()) {
                Text("Lihat menu dulu")
            }
        }
    }
}
