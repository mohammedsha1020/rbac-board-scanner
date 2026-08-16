# Flutter Wrapper Rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-dontwarn io.flutter.embedding.**

# Keep Native Camera Plugin
-keep class com.example.camera.** { *; }
-keep class io.flutter.plugins.camera.** { *; }

# Keep SQLite & Secure Storage Native Plugin Classes
-keep class com.tekartik.sqflite.** { *; }
-keep class com.it_ne.flutter_secure_storage.** { *; }

# Keep Gson / Json Serializations
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Preserve Line Numbers for Exception Stack Traces
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
