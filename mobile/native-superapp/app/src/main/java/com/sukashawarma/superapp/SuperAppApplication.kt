package com.sukashawarma.superapp

import android.app.Application
import com.sukashawarma.superapp.data.SupabaseClient

open class SuperAppApplication : Application() {
    companion object {
        lateinit var instance: SuperAppApplication
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        SupabaseClient.initialize(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
    }
}
