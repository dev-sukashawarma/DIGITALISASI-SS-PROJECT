package com.sukashawarma.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.sukashawarma.customer.navigation.CustomerAppRoot
import com.sukashawarma.customer.ui.theme.SukaTheme

/**
 * Titik masuk utama aplikasi Android pelanggan SukaShawarma.
 *
 * Aplikasi ini HANYA berbicara ke Retail Gateway lewat HTTP.
 * Tidak ada SDK Supabase, anon key, service role, atau URL database di sini.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = AppContainer(applicationContext)

        setContent {
            SukaTheme {
                CustomerAppRoot(container)
            }
        }
    }
}
