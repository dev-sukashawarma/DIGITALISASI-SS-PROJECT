package com.sukashawarma.superapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import com.sukashawarma.superapp.ui.theme.AccentShadow
import com.sukashawarma.superapp.ui.theme.GlassBorder
import com.sukashawarma.superapp.ui.theme.GlassFill

@Composable
fun GlassPanel(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(16.dp),
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = modifier
            .shadow(
                elevation = 16.dp,
                shape = shape,
                ambientColor = AccentShadow,
                spotColor = AccentShadow
            )
            .clip(shape)
            .background(GlassFill)
            .border(1.dp, GlassBorder, shape),
        content = content
    )
}
