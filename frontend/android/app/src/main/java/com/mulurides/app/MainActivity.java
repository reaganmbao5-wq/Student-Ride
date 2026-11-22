package com.jaeyride.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Call super.onCreate FIRST so BridgeActivity sets AppTheme_NoActionBar
        // before EdgeToEdge touches the DecorView (prevents stray native ActionBar).
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new JaeyNativeBridge(), "JaeyNative");
        }
    }

    public class JaeyNativeBridge {
        @JavascriptInterface
        public boolean openPlayStore(String packageName) {
            final String pkg = (packageName != null && !packageName.trim().isEmpty())
                ? packageName.trim()
                : getPackageName();
            runOnUiThread(() -> {
                try {
                    Intent playStoreIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
                    playStoreIntent.setPackage("com.android.vending");
                    playStoreIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(playStoreIntent);
                } catch (Exception e1) {
                    try {
                        Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
                        marketIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(marketIntent);
                    } catch (Exception e2) {
                        try {
                            Intent webIntent = new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse("https://play.google.com/store/apps/details?id=" + pkg)
                            );
                            webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(webIntent);
                        } catch (Exception ignored) {
                            // No browser or Play Store installed on device
                        }
                    }
                }
            });
            return true;
        }
    }
}
