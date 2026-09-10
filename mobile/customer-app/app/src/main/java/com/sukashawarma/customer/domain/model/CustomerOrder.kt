package com.sukashawarma.customer.domain.model

data class CustomerOrder(
    val id: String,
    val orderNumber: Int? = null,
    val outletName: String,
    val status: String,
    val totalAmount: Long,
    val createdAt: String
)
