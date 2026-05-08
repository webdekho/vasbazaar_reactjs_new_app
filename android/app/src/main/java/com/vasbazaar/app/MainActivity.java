package com.vasbazaar.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Window window;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom plugins before super.onCreate
        registerPlugin(SmsSenderPlugin.class);

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
        // Add JavaScript interface to WebView
        getBridge().getWebView().addJavascriptInterface(new NavigationBarInterface(), "AndroidNavigationBar");
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
}
