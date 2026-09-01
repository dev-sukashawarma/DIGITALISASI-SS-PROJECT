package com.sukashawarma.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// Scaffold placeholder — halaman/navigasi/gateway client sesungguhnya ditambah di task berikutnya.
// Aplikasi ini HANYA berbicara ke Retail Gateway lewat HTTP; tidak ada SDK Supabase/kredensial DB di sini.
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier) {
                    CustomerAppRoot()
                }
            }
        }
    }
}

@Composable
fun CustomerAppRoot() {
    Text(text = "Suka Shawarma")
}
