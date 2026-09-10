package com.sukashawarma.customer.domain.model

data class CartItem(
    val menuItemId: String,
    val name: String,
    val unitPrice: Long,
    val quantity: Int,
    val note: String? = null
) {
    val subtotal: Long get() = unitPrice * quantity
}
