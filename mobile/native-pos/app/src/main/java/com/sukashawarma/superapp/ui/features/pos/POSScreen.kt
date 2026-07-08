package com.sukashawarma.superapp.ui.features.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.superapp.data.Staff

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun POSScreen(staff: Staff?, onLogout: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFAF6EE))
    ) {
        // Left Column: Menu Items
        Column(
            modifier = Modifier
                .weight(2f)
                .fillMaxHeight()
                .padding(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("SUKA SHAWARMA POS", style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.ExtraBold, color = Color(0xFFA52A2A)))
                    Text("Kasir: ${staff?.name ?: "Unknown"}", color = Color.Gray)
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Color(0xFFA52A2A))
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
            
            // Menu Grid
            LazyVerticalGrid(
                columns = GridCells.Adaptive(150.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(12) { index ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        modifier = Modifier.height(120.dp)
                    ) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Menu Item ${index + 1}", fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Rp 25.000", color = Color(0xFFF2994A), fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
        
        // Right Column: Cart
        Card(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = "Cart", tint = Color(0xFFA52A2A))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Keranjang Belanja", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                }
                Divider(modifier = Modifier.padding(vertical = 16.dp))
                
                // Cart Items (Empty state for now)
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text("Keranjang kosong", color = Color.Gray)
                }
                
                Divider(modifier = Modifier.padding(vertical = 16.dp))
                
                // Totals
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Subtotal", color = Color.Gray)
                    Text("Rp 0", fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold))
                    Text("Rp 0", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = Color(0xFFE88A1A)))
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Checkout Button
                Button(
                    onClick = { /* TODO: Checkout logic */ },
                    modifier = Modifier.fillMaxWidth().height(60.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFA52A2A))
                ) {
                    Text("BAYAR SEKARANG", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color.White)
                }
            }
        }
    }
}
