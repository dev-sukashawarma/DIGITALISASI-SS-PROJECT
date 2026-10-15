# Pertahankan nomor baris untuk laporan crash di Google Play Console
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.sukashawarma.customer.**$$serializer { *; }
-keepclassmembers class com.sukashawarma.customer.** {
    *** Companion;
}
-keepclasseswithmembers class com.sukashawarma.customer.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.sukashawarma.customer.data.** { *; }

# Ktor Client
-dontwarn io.ktor.**
-dontwarn kotlinx.coroutines.**
-dontwarn org.slf4j.**
-keep class io.ktor.** { *; }

# Google Tink (dipakai oleh EncryptedSharedPreferences melalui refleksi)
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn javax.annotation.**
-dontwarn com.google.errorprone.annotations.**

# Google Play Services Auth / Credential Manager / Google ID
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn com.google.android.gms.**
