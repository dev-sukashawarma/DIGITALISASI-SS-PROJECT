package com.sukashawarma.customer.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * Aplikasi pelanggan belum punya tema gelap yang dirancang — skema gelap di
 * sini hanya jaga-jaga (dark mode sistem) dan memakai palet terang yang sama
 * supaya kontras terkunci (lihat ColorContrastTest) tetap berlaku.
 */
private val SukaLightColorScheme = lightColorScheme(
    primary = SukaBrown,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    secondary = SukaOrange,
    onSecondary = SukaInk,
    tertiary = SukaGreen,
    onTertiary = androidx.compose.ui.graphics.Color.White,
    background = SukaCream,
    onBackground = SukaInk,
    surface = SukaCard,
    onSurface = SukaInk,
    surfaceVariant = SukaTint,
    onSurfaceVariant = SukaBody,
    outline = SukaBorder,
    error = androidx.compose.ui.graphics.Color(0xFFB3261E),
    onError = androidx.compose.ui.graphics.Color.White
)

private val SukaDarkColorScheme = darkColorScheme(
    primary = SukaBrown,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    secondary = SukaOrange,
    onSecondary = SukaInk,
    tertiary = SukaGreen,
    onTertiary = androidx.compose.ui.graphics.Color.White,
    background = SukaCream,
    onBackground = SukaInk,
    surface = SukaCard,
    onSurface = SukaInk,
    surfaceVariant = SukaTint,
    onSurfaceVariant = SukaBody,
    outline = SukaBorder,
    error = androidx.compose.ui.graphics.Color(0xFFB3261E),
    onError = androidx.compose.ui.graphics.Color.White
)

@Composable
fun SukaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) SukaDarkColorScheme else SukaLightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = SukaTypography,
        shapes = SukaShapes,
        content = content
    )
}
