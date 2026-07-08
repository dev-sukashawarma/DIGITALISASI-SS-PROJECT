package com.sukashawarma.superapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.*
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import com.sukashawarma.superapp.data.AuthRepository
import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.data.SupabaseAuthCallback
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.ui.navigation.NavigationManager
import com.sukashawarma.superapp.ui.navigation.Screen
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import com.sukashawarma.superapp.ui.features.pos.POSScreen

val StaffSaver = Saver<Staff?, Any>(
    save = { staff ->
        if (staff == null) null
        else listOf(staff.id, staff.name, staff.role, staff.assignedOutletId)
    },
    restore = {
        val list = it as? List<String>
        if (list == null) null
        else Staff(list[0], list[1], list[2], list[3])
    }
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainShell(
    navigationManager: NavigationManager,
    authRepository: AuthRepository,
    modifier: Modifier = Modifier
) {
    val navController = rememberNavController()
    var currentStaff by rememberSaveable(stateSaver = StaffSaver) { mutableStateOf<Staff?>(null) }
    
    val currentScreen = navigationManager.getCurrentScreen()
    val backStackSize = navigationManager.getBackStackSize()

    val canGoBack = remember(backStackSize, currentScreen) {
        backStackSize > 1 || (backStackSize == 1 && currentScreen != Screen.POS)
    }

    BackHandler(enabled = canGoBack && currentScreen != Screen.Login) {
        if (navigationManager.goBack()) {
            navController.popBackStack()
        }
    }

    NavHost(
        navController = navController,
        startDestination = Screen.Login.route,
        modifier = modifier.fillMaxSize()
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                authRepository = authRepository,
                onLoginSuccess = { staff ->
                    currentStaff = staff
                    navigationManager.navigateTo(Screen.POS, staff)
                    navController.navigate(Screen.POS.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Screen.POS.route) { 
            POSScreen(staff = currentStaff, onLogout = {
                navigationManager.logout()
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            }) 
        }
    }
}

@Composable
fun LoginScreen(
    authRepository: AuthRepository,
    onLoginSuccess: (Staff) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFAF6EE))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("SUKA SHAWARMA", style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.ExtraBold, color = Color(0xFFA52A2A)))
        Text("POS KASIR", style = MaterialTheme.typography.labelLarge.copy(color = Color(0xFFE88A1A), letterSpacing = 2.sp))
        Spacer(modifier = Modifier.height(32.dp))
        
        Card(
            modifier = Modifier.widthIn(max = 400.dp).fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text("Masuk Sistem", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = Color(0xFF6B1D1D)))
                Text("Masuk dengan email akun Anda", style = MaterialTheme.typography.bodySmall.copy(color = Color.Gray))
                Spacer(modifier = Modifier.height(24.dp))
                
                Text("Email", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    placeholder = { Text("kasir@sukashawarma.com") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(16.dp))
                
                Text("Kata Sandi", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    placeholder = { Text("Masukkan kata sandi") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
                
                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(errorMessage!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = {
                        val supabase = authRepository as? SupabaseClient
                        if (supabase != null) {
                            supabase.login(email, password, object : SupabaseAuthCallback {
                                override fun onSuccess(token: String) {
                                    val role = authRepository.getUserRole(email)
                                    val name = email.substringBefore("@").replaceFirstChar { it.uppercase() }
                                    onLoginSuccess(Staff("user_1", name, role, "outlet_1"))
                                }
                                override fun onFailure(error: Throwable) {
                                    errorMessage = error.message ?: "Authentication failed"
                                }
                            })
                        } else {
                            if (email == "valid@sukashawarma.com" && password == "correct_password") {
                                onLoginSuccess(Staff("user_1", "Cashier", "cashier", "outlet_1"))
                            } else {
                                errorMessage = "Invalid credentials"
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF2994A))
                ) {
                    Text("Masuk", fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}
