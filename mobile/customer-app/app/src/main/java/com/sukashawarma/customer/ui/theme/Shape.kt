package com.sukashawarma.customer.ui.theme

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

val SukaCardShape = RoundedCornerShape(16.dp)
val SukaInputShape = RoundedCornerShape(12.dp)
val SukaButtonShape = CircleShape

val SukaShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = SukaInputShape,
    medium = SukaCardShape,
    large = RoundedCornerShape(20.dp),
    extraLarge = SukaButtonShape
)
