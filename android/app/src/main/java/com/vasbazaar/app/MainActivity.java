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
        // Add JavaScript interfaces to WebView
        getBridge().getWebView().addJavascriptInterface(new NavigationBarInterface(), "AndroidNavigationBar");
        getBridge().getWebView().addJavascriptInterface(new UpiIntentInterface(), "AndroidUpiIntent");
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

                // Use simple ACTION_VIEW without specifying package
                // Let the system handle app selection
                final Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setData(Uri.parse(upiUrl));

                // Run on UI thread to ensure proper activity context
                runOnUiThread(() -> {
                    try {
                        startActivity(intent);
                        android.util.Log.d("UpiIntent", "Activity started successfully");
                    } catch (android.content.ActivityNotFoundException e) {
                        android.util.Log.e("UpiIntent", "No activity found: " + e.getMessage());
                        Toast.makeText(MainActivity.this, "No UPI app ready. Please login to your UPI app (GPay/PhonePe/Paytm) first.", Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        android.util.Log.e("UpiIntent", "Error: " + e.getMessage());
                        Toast.makeText(MainActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
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
