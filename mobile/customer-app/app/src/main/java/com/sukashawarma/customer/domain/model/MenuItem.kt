package com.sukashawarma.customer.domain.model

data class MenuItem(
    val id: String,
    val name: String,
    val description: String? = null,
    val price: Long,
    val imageUrl: String? = null,
    val isAvailable: Boolean = true,
    val categoryId: String? = null,
    val categoryName: String? = null
)
