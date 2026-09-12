package com.sukashawarma.customer.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer

/**
 * Memberikan animasi membal (bounce / tactile spring) saat elemen ditekan.
 *
 * Memberi umpan balik fisik yang memuaskan dan modern bagi pelanggan
 * saat berinteraksi dengan kartu menu atau tombol aksi utama.
 */
fun Modifier.bounceClick(
    scaleDown: Float = 0.96f,
    interactionSource: MutableInteractionSource? = null,
    onClick: (() -> Unit)? = null
): Modifier = composed {
    val localInteractionSource = remember { MutableInteractionSource() }
    val actualInteractionSource = interactionSource ?: localInteractionSource
    val isPressed by actualInteractionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed) scaleDown else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "bounceScale"
    )

    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .then(
            if (onClick != null) {
                Modifier.clickable(
                    interactionSource = actualInteractionSource,
                    indication = null,
                    onClick = onClick
                )
            } else {
                Modifier
            }
        )
}
