package com.sukashawarma.superapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.sukashawarma.superapp.data.AuthRepository
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.ui.MainShell
import com.sukashawarma.superapp.ui.navigation.NavigationManager
import com.sukashawarma.superapp.ui.theme.SuperAppTheme

class MainViewModel : ViewModel() {
    private var navManager: NavigationManager? = null

    fun getNavigationManager(authRepository: AuthRepository): NavigationManager {
        return navManager ?: NavigationManager(authRepository).also {
            navManager = it
        }
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val authRepository = if (SupabaseClient.isInitialized()) {
            SupabaseClient.getInstance()
        } else {
            SupabaseClient(isTesting = true)
        }
        
        val viewModel = ViewModelProvider(this)[MainViewModel::class.java]
        val navigationManager = viewModel.getNavigationManager(authRepository)
        
        setContent {
            SuperAppTheme {
                MainShell(
                    navigationManager = navigationManager,
                    authRepository = authRepository
                )
            }
        }
    }
}
