# ==============================================================================
# Jaey Ride — R8 / ProGuard Optimization & Keep Rules
# Enables DEX shrinking + obfuscation well above Google Play's 25% threshold
# while preserving Capacitor core, annotations, plugins, WebView bridges,
# Ionic geolocation libs, Google Auth, and Firebase Messaging.
# ==============================================================================

# Preserve clean stack traces, annotations, generics, and Kotlin metadata
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations
-renamesourcefileattribute SourceFile
-keep class kotlin.Metadata { *; }

# Keep MainActivity & native JS bridge helpers
-keep class com.jaeyride.app.** { *; }

# Keep Capacitor core runtime, Bridge, Plugin, PluginHandle, and ALL annotations
# (Critical: Plugin.getPermissionStates() reflects on @CapacitorPlugin/@Permission)
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.** { *; }

# Keep ALL Capacitor official & community plugins and their Ionic backing libraries
-keep class com.capacitorjs.plugins.** { *; }
-keep class io.ionic.libs.** { *; }
-keep class com.codetrixstudio.capacitor.GoogleAuth.** { *; }

# Keep any custom Capacitor plugin classes loaded by reflection
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# Keep Android WebView @JavascriptInterface methods (JS-to-Native bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Cordova plugin classes if any are loaded reflectively
-keep class * extends org.apache.cordova.CordovaPlugin {
    public <init>();
}

# Keep Firebase Messaging Service & Google Play Services reflective entrypoints
-keep class com.capacitorjs.plugins.pushnotifications.MessagingService { *; }
-keep class com.google.firebase.messaging.FirebaseMessagingService { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn org.apache.cordova.**
-dontwarn io.ionic.libs.**
