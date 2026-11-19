# ==============================================================================
# Jaey Ride — R8 / ProGuard Optimization & Keep Rules
# Enables DEX shrinking + obfuscation above Google Play's 25% threshold while
# preserving Capacitor plugins, WebView JS interfaces, Google Auth, and FCM.
# ==============================================================================

# Preserve clean stack traces for Play Console deobfuscation mapping
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Keep MainActivity entrypoint
-keep class com.jaeyride.app.MainActivity { *; }

# Keep Capacitor plugin classes loaded by reflection from capacitor.plugins.json
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * extends com.getcapacitor.Plugin {
    public <init>();
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}
-keep class * extends com.getcapacitor.Plugin {
    public <init>();
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}

# Explicitly preserve registered Capacitor plugin classes & Google Auth plugin
-keep class com.capacitorjs.plugins.** {
    public <init>(...);
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}
-keep class com.codetrixstudio.capacitor.GoogleAuth.** { *; }
-keep class com.getcapacitor.plugin.SystemBars { *; }
-keep class com.getcapacitor.plugin.CapacitorCookies { *; }
-keep class com.getcapacitor.plugin.CapacitorHttp { *; }
-keep class com.getcapacitor.plugin.WebView { *; }
-keep class com.getcapacitor.MessageHandler { *; }

# Keep Android WebView @JavascriptInterface methods (Capacitor JS-to-Native bridge)
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
