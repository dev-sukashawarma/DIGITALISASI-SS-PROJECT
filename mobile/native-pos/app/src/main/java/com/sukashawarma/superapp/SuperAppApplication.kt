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
        SupabaseClient.initialize("https://khpkoreaaucvyqfhynfq.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso")
    }
}
