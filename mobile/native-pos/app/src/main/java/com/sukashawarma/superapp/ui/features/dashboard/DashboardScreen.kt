package com.sukashawarma.superapp.ui.features.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.sukashawarma.superapp.data.Staff

@Composable
fun DashboardScreen(staff: Staff?) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Dashboard", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        if (staff != null) {
            Text("Welcome, ${staff.name} (${staff.role.uppercase()})", style = MaterialTheme.typography.bodyLarge)
        } else {
            Text("Welcome!", style = MaterialTheme.typography.bodyLarge)
        }
    }
}
