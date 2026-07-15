package com.vasbazaar.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Window window;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        window = getWindow();

        // WebView debugging enabled for testing
        WebView.setWebContentsDebuggingEnabled(true);

        // Set initial navigation bar color to dark
        setNavigationBarColor("#0B0B0B", false);
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getBridge().getWebView();

        // Lock the WebView text zoom to 100% so the app ignores the device's
        // system "Font size" accessibility setting. Without this, phones set to
        // a large font scale inflate all in-app text and break the layout
        // (native apps like Paytm behave the same way by design).
        webView.getSettings().setTextZoom(100);

        // Add JavaScript interfaces to WebView
        webView.addJavascriptInterface(new NavigationBarInterface(), "AndroidNavigationBar");
        webView.addJavascriptInterface(new UpiIntentInterface(), "AndroidUpiIntent");
    }

    private void setNavigationBarColor(String color, boolean isLight) {
        runOnUiThread(() -> {
            window.setNavigationBarColor(Color.parseColor(color));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                View decorView = window.getDecorView();
                int flags = decorView.getSystemUiVisibility();
                if (isLight) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                } else {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                decorView.setSystemUiVisibility(flags);
            }
        });
    }

    private class NavigationBarInterface {
        @JavascriptInterface
        public void setColor(String color, boolean isLight) {
            setNavigationBarColor(color, isLight);
        }
    }

    // UPI Intent interface - allows JavaScript to launch UPI apps
    private class UpiIntentInterface {
        @JavascriptInterface
        public boolean openUpiUrl(String upiUrl) {
            try {
                android.util.Log.d("UpiIntent", "Opening UPI URL: " + upiUrl);

                final Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(upiUrl));

                // Required for Android 13+ (TIRAMISU) when starting from WebView context
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                }

                // Do NOT gate on resolveActivity(): on Android 11+ package-visibility
                // rules can make it return null (a false negative) even when a capable UPI
                // app is installed, unless every app is listed in the manifest <queries>.
                // startActivity() itself is authoritative — it launches the on-device UPI
                // chooser when handlers exist and throws ActivityNotFoundException only when
                // genuinely none can handle the intent. Attempt the launch and report a
                // failure ONLY if it actually throws.
                runOnUiThread(() -> {
                    try {
                        startActivity(intent);
                        android.util.Log.d("UpiIntent", "Activity started successfully");
                    } catch (android.content.ActivityNotFoundException e) {
                        android.util.Log.e("UpiIntent", "No activity found: " + e.getMessage());
                        Toast.makeText(MainActivity.this,
                            "No UPI app found. Please install GPay, PhonePe, or Paytm.",
                            Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        android.util.Log.e("UpiIntent", "Error: " + e.getMessage());
                        Toast.makeText(MainActivity.this, "Error: " + e.getMessage(),
                            Toast.LENGTH_LONG).show();
                    }
                });

                return true;
            } catch (Exception e) {
                android.util.Log.e("UpiIntent", "Exception: " + e.getMessage());
                e.printStackTrace();
                return false;
            }
        }
    }
}
