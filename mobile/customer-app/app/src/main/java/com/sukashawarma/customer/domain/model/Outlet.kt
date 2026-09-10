package com.sukashawarma.customer.domain.model

data class Outlet(
    val id: String,
    val name: String,
    val address: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val isActive: Boolean = true
)
