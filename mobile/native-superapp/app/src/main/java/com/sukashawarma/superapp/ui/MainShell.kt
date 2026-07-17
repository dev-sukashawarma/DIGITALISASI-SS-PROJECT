package com.sukashawarma.superapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.*
import com.sukashawarma.superapp.R
import com.sukashawarma.superapp.data.AuthRepository
import com.sukashawarma.superapp.data.Staff
import com.sukashawarma.superapp.data.SupabaseAuthCallback
import com.sukashawarma.superapp.data.SupabaseClient
import com.sukashawarma.superapp.ui.features.attendance.AttendanceScreen
import com.sukashawarma.superapp.ui.features.dashboard.DashboardScreen
import com.sukashawarma.superapp.ui.features.fulfillment.FulfillmentScreen
import com.sukashawarma.superapp.ui.features.inventory.InventoryScreen
import com.sukashawarma.superapp.ui.features.enrollment.EnrollmentScreen
import com.sukashawarma.superapp.ui.navigation.NavigationManager
import com.sukashawarma.superapp.ui.navigation.Screen
import androidx.compose.runtime.saveable.Saver
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope

val StaffSaver = Saver<Staff?, Any>(
    save = { staff ->
        if (staff == null) null
        else mapOf(
            "id" to staff.id, 
            "name" to staff.name, 
            "role" to staff.role, 
            "assignedOutletId" to staff.assignedOutletId,
            "faceDescriptor" to staff.faceDescriptor?.toList()
        )
    },
    restore = { value ->
        val map = value as? Map<*, *> ?: return@Saver null
        val faceDescList = map["faceDescriptor"] as? List<*>
        val faceDescriptor = faceDescList?.mapNotNull { (it as? Number)?.toFloat() }?.toFloatArray()
        Staff(
            map["id"] as String, 
            map["name"] as String, 
            map["role"] as String, 
            map["assignedOutletId"] as String,
            faceDescriptor
        )
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
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showShell = currentRoute != Screen.Login.route && currentRoute != Screen.Attendance.route && currentRoute != null

    val stitchPrimary = Color(0xFF904D00)
    val stitchBackground = Color(0xFFFFF8F1)

    BackHandler(enabled = showShell && currentRoute != Screen.Dashboard.route) {
        if (navigationManager.goBack()) navController.popBackStack()
    }

    val contentBlock = @Composable { paddingValues: PaddingValues ->
        NavHost(navController = navController, startDestination = Screen.Login.route, modifier = Modifier.padding(paddingValues)) {
            composable(Screen.Login.route) {
                LoginScreen(authRepository, onLoginSuccess = { staff ->
                    currentStaff = staff
                    navigationManager.navigateTo(Screen.Dashboard, staff)
                    navController.navigate(Screen.Dashboard.route) { popUpTo(Screen.Login.route) { inclusive = true } }
                })
            }
            composable(Screen.Dashboard.route) { 
                DashboardScreen(currentStaff) { appName ->
                    val target = when (appName) {
                        "Absensi" -> Screen.Attendance
                        "Enrollment" -> Screen.Enroll
                        else -> null
                    }
                    if (target != null && navigationManager.navigateTo(target, currentStaff)) {
                        navController.navigate(target.route)
                    }
                }
            }
            composable(Screen.Inventory.route) { InventoryScreen() }
            composable(Screen.Attendance.route) {
                // Selalu refresh face descriptor dari DB saat buka halaman Absensi
                // agar data terbaru dari re-enrollment langsung dipakai
                var liveFaceDescriptor by remember { mutableStateOf(currentStaff?.faceDescriptor) }
                LaunchedEffect(Unit) {
                    try {
                        val freshProfile = SupabaseClient.getInstance().getStaffProfile(currentStaff?.id ?: "")
                        if (freshProfile != null) {
                            liveFaceDescriptor = freshProfile.faceDescriptor
                            // Update currentStaff juga agar konsisten
                            currentStaff = freshProfile
                        }
                    } catch (_: Exception) {
                        // Jika gagal fetch, pakai data yang sudah ada
                    }
                }
                AttendanceScreen(staffName = currentStaff?.name, staffFaceDescriptor = liveFaceDescriptor, onBackClick = { navController.popBackStack() })
            }
            composable(Screen.Fulfillment.route) { FulfillmentScreen() }
            composable(Screen.Enroll.route) {
                if (currentStaff != null) {
                    EnrollmentScreen(adminStaff = currentStaff!!) {
                        navController.popBackStack()
                    }
                }
            }
        }
    }

    if (showShell) {
        Scaffold(
            topBar = {
                TopAppBar(
                    modifier = Modifier.statusBarsPadding(),
                    title = {
                        Column {
                            Text("SUKA Portal", fontWeight = FontWeight.Bold, color = stitchPrimary, fontSize = 18.sp)
                            currentStaff?.name?.let { Text("Halo, $it", fontSize = 13.sp, color = Color.Gray) }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = stitchBackground),
                    navigationIcon = {
                        Box(modifier = Modifier.padding(start = 16.dp, end = 12.dp).size(40.dp).background(Color.White, CircleShape).border(1.dp, Color.White.copy(alpha = 0.5f), CircleShape), contentAlignment = Alignment.Center) {
                            Image(painter = painterResource(id = R.drawable.logo), contentDescription = "Profile", modifier = Modifier.fillMaxSize().clip(CircleShape))
                        }
                    },
                    actions = {
                        IconButton(onClick = { }) {
                            Surface(shape = CircleShape, color = Color.White.copy(alpha = 0.6f), modifier = Modifier.size(40.dp)) {
                                Box(contentAlignment = Alignment.Center) { Icon(Icons.Default.Settings, null, tint = Color.DarkGray, modifier = Modifier.size(20.dp)) }
                            }
                        }
                    }
                )
            }
            // Bottom nav fungsional = fase 3. Tombol dekoratif (onClick kosong) dihapus —
            // jangan tampilkan navigasi yang tidak benar-benar berfungsi.
        ) { padding -> contentBlock(padding) }
    } else {
        contentBlock(PaddingValues(0.dp))
    }
}

@Composable
fun LoginScreen(authRepository: AuthRepository, onLoginSuccess: (Staff) -> Unit) {
    var usernameOrEmail by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    val brandMaroon = Color(0xFF701604); val primaryColor = Color(0xFF904D00); val backgroundColor = Color(0xFFFFF8F1)

    Box(modifier = Modifier.fillMaxSize().background(backgroundColor)) {
        Box(modifier = Modifier.offset(x = (-50).dp, y = (-50).dp).size(300.dp).background(Color(0xFFFFDCC2).copy(alpha = 0.4f), CircleShape))
        Box(modifier = Modifier.align(Alignment.BottomEnd).offset(x = 50.dp, y = 50.dp).size(300.dp).background(Color(0xFFFFDAD3).copy(alpha = 0.4f), CircleShape))
        Column(modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Image(painter = painterResource(id = R.drawable.logo), contentDescription = "Logo", modifier = Modifier.padding(bottom = 32.dp).width(180.dp).height(100.dp))
            Surface(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)), color = Color.White.copy(alpha = 0.4f), border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.6f))) {
                Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Welcome Back", style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold, color = brandMaroon))
                    Text("Sign in to manage your outlet.", style = MaterialTheme.typography.bodyMedium.copy(color = Color(0xFF544437)))
                    Spacer(modifier = Modifier.height(32.dp))
                    OutlinedTextField(value = usernameOrEmail, onValueChange = { usernameOrEmail = it }, label = { Text("Username") }, leadingIcon = { Icon(Icons.Default.Person, null) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Password") }, leadingIcon = { Icon(Icons.Default.Lock, null) }, trailingIcon = { IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) { Icon(if (isPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff, null) } }, visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                    if (errorMessage != null) Text(errorMessage!!, color = Color.Red, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = {
                        if (isLoading) return@Button
                        isLoading = true
                        errorMessage = null
                        val supabase = authRepository as? SupabaseClient
                        if (supabase != null) {
                            supabase.login(usernameOrEmail, password, object : SupabaseAuthCallback {
                                override fun onSuccess(token: String) { 
                                    // Fetch real staff profile
                                    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                                        try {
                                            val profile = authRepository.getStaffProfile(usernameOrEmail)
                                            if (profile != null) {
                                                onLoginSuccess(profile)
                                                // Jangan set isLoading = false karena layar akan pindah
                                            } else {
                                                errorMessage = "Profil kru tidak ditemukan di database."
                                                isLoading = false
                                            }
                                        } catch (e: Exception) {
                                            errorMessage = "Gagal memuat profil: ${e.message}"
                                            isLoading = false
                                        }
                                    }
                                }
                                override fun onFailure(error: Throwable) { 
                                    errorMessage = error.message ?: "Login Gagal" 
                                    isLoading = false
                                }
                            })
                        } else if (usernameOrEmail == "admin" && password == "admin") {
                            onLoginSuccess(Staff("user_1", "Admin", "admin", "Outlet Utama"))
                        } else { 
                            errorMessage = "Username/Password Salah" 
                            isLoading = false
                        }
                    }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = primaryColor)) {
                        if (isLoading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Masuk", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        }
                    }
                }
            }
        }
    }
}