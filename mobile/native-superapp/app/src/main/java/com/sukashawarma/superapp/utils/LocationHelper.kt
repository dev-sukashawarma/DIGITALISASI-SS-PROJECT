package com.sukashawarma.superapp.utils

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.tasks.await
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

class LocationHelper(private val context: Context) {
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

    /**
     * Gets the current location with high accuracy.
     * Returns null if permission is denied or location is unavailable.
     */
    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(): Location? {
        return try {
            val location = fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                null
            ).await()
            location
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    companion object {
        private const val EARTH_RADIUS_M = 6371000.0

        /**
         * Calculates the Haversine distance between two coordinates in meters.
         */
        fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = sin(dLat / 2) * sin(dLat / 2) +
                    cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                    sin(dLon / 2) * sin(dLon / 2)
            val c = 2 * atan2(sqrt(a), sqrt(1 - a))
            return EARTH_RADIUS_M * c
        }

        /**
         * Calculates adjusted distance based on accuracy.
         * Adjusted Distance = Math.max(0, Distance_Meters - Accuracy_Meters)
         */
        fun calculateAdjustedDistance(distanceMeters: Double, accuracyMeters: Float): Double {
            return Math.max(0.0, distanceMeters - accuracyMeters)
        }
    }
}
